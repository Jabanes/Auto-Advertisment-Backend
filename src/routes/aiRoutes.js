/**
 * AI Routes — image generation using OpenAI for nested user structure
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

router.post("/generate-ad-image", verifyAccessToken, async (req, res) => {
  try {
    const { businessId, productId } = req.body;
    const uid = req.user.uid;

    if (!businessId || !productId) {
      return res.status(400).json({ success: false, error: "Missing businessId or productId" });
    }

    const productRef = db
      .collection("users")
      .doc(uid)
      .collection("businesses")
      .doc(businessId)
      .collection("products")
      .doc(productId);

    const productDoc = await productRef.get();
    if (!productDoc.exists) return res.status(404).json({ success: false, error: "Product not found" });

    const product = productDoc.data();
    const { imageUrl, imagePrompt } = product;
    if (!imageUrl || !imagePrompt)
      return res.status(400).json({ success: false, error: "Missing imageUrl or imagePrompt" });

    // Download + convert
    const imageResponse = await fetch(imageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const pngBuffer = await sharp(buffer).png().toBuffer();
    const tmpFile = path.join(os.tmpdir(), `${productId}.png`);
    fs.writeFileSync(tmpFile, pngBuffer);

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", imagePrompt);
    form.append("size", "1024x1024");
    form.append("image", fs.createReadStream(tmpFile), { filename: `${productId}.png`, contentType: "image/png" });

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

    const generatedBuffer = Buffer.from(data.data[0].b64_json, "base64");

    const bucket = storage.bucket(FIREBASE_STORAGE_BUCKET);
    const filePath = `generated_ads/${uid}/${businessId}/${productId}.png`;
    const file = bucket.file(filePath);

    await file.save(generatedBuffer, { metadata: { contentType: "image/png" }, public: true });

    const publicUrl = `https://storage.googleapis.com/${FIREBASE_STORAGE_BUCKET}/${filePath}`;
    await productRef.set({ generatedImageUrl: publicUrl }, { merge: true });

    res.json({
      success: true,
      message: `Generated advertisement image for ${productId}`,
      generatedImageUrl: publicUrl,
    });
  } catch (err) {
    console.error("❌ Error generating ad image:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;
