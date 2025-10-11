const express = require("express");
const { verifyAccessToken } = require("../middleware/auth");
const { db, storage, admin } = require("../config/firebase");
const { OPENAI_API_KEY, OPENAI_ORG_ID, FIREBASE_STORAGE_BUCKET } = require("../config/env");
const { error } = require("../utils/logger");

const router = express.Router();

router.post("/generate-ad-image", verifyAccessToken, async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, error: "Missing productId" });
    }

    const productRef = db.collection("products").doc(productId);
    const productDoc = await productRef.get();
    if (!productDoc.exists) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    const product = productDoc.data();
    const { ImageUrl, imagePrompt } = product;
    if (!ImageUrl || !imagePrompt) {
      return res.status(400).json({ success: false, error: "Missing ImageUrl or imagePrompt" });
    }

    const fetch = (await import("node-fetch")).default;
    const sharp = (await import("sharp")).default;
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const FormData = (await import("form-data")).default;

    const imageResponse = await fetch(ImageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const pngBuffer = await sharp(buffer).png().toBuffer();

    const tmpFile = path.join(os.tmpdir(), `${productId}.png`);
    fs.writeFileSync(tmpFile, pngBuffer);

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", imagePrompt);
    form.append("size", "1024x1024");
    form.append("image", fs.createReadStream(tmpFile), {
      filename: `${productId}.png`,
      contentType: "image/png",
    });

    const headers = {
      ...form.getHeaders(),
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Organization": OPENAI_ORG_ID,
    };

    const openaiResp = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers,
      body: form,
    });
    const data = await openaiResp.json();

    if (!data?.data?.[0]?.b64_json) {
      error("❌ Invalid OpenAI response:", data);
      return res.status(500).json({ success: false, error: "Invalid OpenAI response" });
    }

    const generatedBuffer = Buffer.from(data.data[0].b64_json, "base64");
    const filePath = `generated_ads/${product.businessId}/${productId}.png`;
    const file = storage.file(filePath);

    await file.save(generatedBuffer, {
      metadata: { contentType: "image/png" },
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/${FIREBASE_STORAGE_BUCKET}/${filePath}`;

    await productRef.set(
      {
        generatedImageUrl: publicUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.json({
      success: true,
      message: `Generated advertisement image for product ${productId}`,
      generatedImageUrl: publicUrl,
    });
  } catch (err) {
    error("❌ Error generating ad image:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;
