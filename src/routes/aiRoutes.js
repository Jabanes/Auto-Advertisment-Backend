/**
 * AI Routes — image generation using OpenAI for nested user structure
 *
 * 🔄 Integrates with the unified `status` field:
 *    - "pending"   → waiting for enrichment
 *    - "enriched"  → AI-generated ad content created
 *    - "posted"    → successfully posted or finalized
 *
 * TODO:
 *   - When automatic posting workflow (e.g., to Instagram/Facebook) is complete,
 *     update the product `status` from "enriched" → "posted".
 *   - Deprecate any workflow references to "isEnriched"/"isPosted" entirely.
 */

const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { db, storage } = require("../config/firebase");
const { verifyAccessToken } = require("../middleware/authMiddleware");
const { OPENAI_API_KEY, OPENAI_ORG_ID, FIREBASE_STORAGE_BUCKET } = require("../config/env");
const fetch = require("node-fetch");
const sharp = require("sharp");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { STATUS } = require("../constants/statusEnum");
const { emitProductUpdate } = require("../utils/socketEmitter");

router.post("/generate-ad-image", verifyAccessToken, async (req, res) => {
  const { businessId, productId } = req.body;
  const uid = req.user.uid;

  // Define productRef here to make it available in the catch block
  const productRef =
    businessId && productId && uid
      ? db.collection("users").doc(uid).collection("businesses").doc(businessId).collection("products").doc(productId)
      : null;

  try {
    if (!productRef) {
      return res.status(400).json({ success: false, error: "Missing businessId or productId" });
    }

    const productDoc = await productRef.get();
    if (!productDoc.exists)
      return res.status(404).json({ success: false, error: "Product not found" });

    const product = productDoc.data();
    const { imageUrl, imagePrompt } = product;

    if (!imageUrl || !imagePrompt)
      return res.status(400).json({ success: false, error: "Missing imageUrl or imagePrompt" });

    // ----------------------------------------------------
    // Step 1: Download + convert original image to PNG
    // ----------------------------------------------------
    const imageResponse = await fetch(imageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const pngBuffer = await sharp(buffer).png().toBuffer();
    const tmpFile = path.join(os.tmpdir(), `${productId}.png`);
    fs.writeFileSync(tmpFile, pngBuffer);

    // ----------------------------------------------------
    // Step 2: Send image + prompt to OpenAI for editing
    // ----------------------------------------------------
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", imagePrompt);
    form.append("size", "1024x1024");
    form.append("image", fs.createReadStream(tmpFile), {
      filename: `${productId}.png`,
      contentType: "image/png",
    });

    const openaiResp = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Organization": OPENAI_ORG_ID,
      },
      body: form,
    });

    const data = await openaiResp.json();
    if (!data?.data?.[0]?.b64_json)
      return res.status(500).json({ success: false, error: "OpenAI did not return valid image data" });

    // ----------------------------------------------------
    // Step 3: Upload to Firebase Storage
    // ----------------------------------------------------
    const generatedBuffer = Buffer.from(data.data[0].b64_json, "base64");
    const bucket = storage.bucket(FIREBASE_STORAGE_BUCKET);
    const filePath = `users/${uid}/businesses/${businessId}/products/${productId}/generated/${Date.now()}-generated.jpg`;

    // ✅ Create the file reference before saving
    const file = bucket.file(filePath);

    await file.save(generatedBuffer, {
      metadata: { contentType: "image/png" },
      resumable: false,
    });

    const [publicUrl] = await file.getSignedUrl({
      action: "read",
      expires: "03-09-2030",
    });

    // ----------------------------------------------------
    // Step 4: Update Firestore (status → "enriched")
    // ----------------------------------------------------
    console.log(`[AI] Updating product ${productId} in Firestore with generated image and status=${STATUS.ENRICHED}`);
    
    await productRef.set(
      {
        generatedImageUrl: publicUrl,
        status: STATUS.ENRICHED,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(
      `✅ [AI] Firestore update committed for ${productId} | ` +
      `Status: processing → ${STATUS.ENRICHED} | ImageURL: ${publicUrl.substring(0, 50)}...`
    );

    // Fetch updated product for socket event
    const updatedDoc = await productRef.get();
    const updatedProduct = {
      id: productId,
      businessId,
      ...updatedDoc.data(),
    };

    // 🔔 Emit product:updated event to user's room using centralized emitter
    const io = req.app.get("io");
    emitProductUpdate(io, uid, updatedProduct);
    res.json({
      success: true,
      message: `Generated advertisement image for ${productId}`,
      generatedImageUrl: publicUrl,
    });

    // ----------------------------------------------------
    // TODO (future step):
    // After posting the generated ad to social media or marketplace,
    // update:
    //   await productRef.set({ status: "posted", postDate: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    // ----------------------------------------------------
  } catch (err) {
    console.error(`❌ [AI] Error generating ad image for product ${productId}:`, err.message);
    console.error(`  └─ Stack trace:`, err.stack);

    // If an error occurs, update the product status to FAILED
    if (productRef) {
      console.log(`[AI] Updating product ${productId} status to FAILED due to error`);
      
      await productRef.set(
        {
          status: STATUS.FAILED,
          errorMessage: err.message || "AI generation failed",
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log(
        `✅ [AI] Firestore update committed for ${productId} | ` +
        `Status: processing → ${STATUS.FAILED} | Error: ${err.message}`
      );

      // Fetch updated product for socket event
      const failedDoc = await productRef.get();
      const failedProduct = {
        id: productId,
        businessId,
        ...failedDoc.data(),
      };

      // 🔔 Emit product:updated event with failed status using centralized emitter
      const io = req.app.get("io");
      emitProductUpdate(io, uid, failedProduct);
    }

    res.status(500).json({ success: false, error: "Internal server error", details: err.message });
  }
});

module.exports = router;
