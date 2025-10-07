require("dotenv").config({ quiet: true }); // Load environment variables from .env file

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const crypto = require("crypto");
const OpenAI = require("openai");

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID,
});

// Load Firebase service account key from path specified in environment variables
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

/**
 * Upload products
 */
app.post("/upload-products", async (req, res) => {
    try {
        let { businessId, businessInfo, products } = req.body;

        if (!businessId || !products) {
            return res
                .status(400)
                .json({ error: "Request must include businessId and products" });
        }

        if (typeof businessInfo === "string") {
            try {
                businessInfo = JSON.parse(businessInfo);
            } catch (e) {
                businessInfo = {};
            }
        }

        if (!Array.isArray(products)) {
            products = [products];
        }

        const businessRef = db.collection("businesses").doc(businessId);
        await businessRef.set(businessInfo || {}, { merge: true });

        const batch = db.batch();
        const now = admin.firestore.FieldValue.serverTimestamp();

        products.forEach((product) => {
            const productId =
                product.id ||
                crypto.createHash("md5").update(product.Name).digest("hex");

            const productRef = businessRef.collection("products").doc(productId);

            batch.set(
                productRef,
                {
                    ...product,
                    createdAt: now,
                    updatedAt: now,
                    isPosted: false,
                    isEnriched: false,   // NEW FLAG
                    postDate: null,
                },
                { merge: true }
            );
        });

        await batch.commit();

        res.json({
            success: true,
            message: `Saved ${products.length} products for business ${businessId}`,
            businessId: businessId,
            savedCount: products.length
        });
    } catch (err) {
        console.error("❌ Error saving products:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});


/**
 * Get next unposted AND not yet enriched product
 */
app.get("/next-product/:businessId", async (req, res) => {
    try {
        const { businessId } = req.params;
        const snapshot = await db
            .collection("businesses")
            .doc(businessId)
            .collection("products")
            .where("isPosted", "==", false)
            .where("isEnriched", "==", false)   // FILTER OUT ALREADY ENRICHED
            .limit(1)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({ error: "No unposted and unenriched products found" });
        }

        const doc = snapshot.docs[0];
        res.json({
            businessId,
            productId: doc.id,
            ...doc.data()
        });
    } catch (err) {
        console.error("❌ Error fetching product:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Update product with generated advertisement + image prompt
 */
app.post("/update-product/:businessId/:productId", async (req, res) => {
    try {
        const { businessId, productId } = req.params;
        const { advertisementText, imagePrompt } = req.body;

        const productRef = db
            .collection("businesses")
            .doc(businessId)
            .collection("products")
            .doc(productId);

        await productRef.set(
            {
                advertisementText: advertisementText || null,
                imagePrompt: imagePrompt || null,
                isEnriched: true,   // MARK AS ENRICHED
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        res.json({
            success: true,
            message: `Updated product ${productId} with advertisement fields`,
        });
    } catch (err) {
        console.error("❌ Error updating product:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Generate AI Advertisement Image for Product (using OpenAI DALL·E 3 + FormData)
 */
app.post("/generate-ad-image", async (req, res) => {
    try {
        const { businessId, productId } = req.body;

        if (!businessId || !productId) {
            return res.status(400).json({ error: "Missing businessId or productId" });
        }

        // 1️⃣ Fetch product details
        const productRef = db.collection("businesses")
            .doc(businessId)
            .collection("products")
            .doc(productId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            return res.status(404).json({ error: "Product not found" });
        }

        const product = productDoc.data();
        const { ImageUrl, imagePrompt } = product;

        if (!ImageUrl || !imagePrompt) {
            return res.status(400).json({ error: "Product missing ImageUrl or imagePrompt" });
        }

        // 2️⃣ Download image and convert to PNG (safe format)
        const fetch = (await import("node-fetch")).default;
        const sharp = (await import("sharp")).default;
        const fs = await import("fs");
        const path = await import("path");
        const os = await import("os");
        const FormData = (await import("form-data")).default;

        const imageResponse = await fetch(ImageUrl);
        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        const pngBuffer = await sharp(buffer).png().toBuffer();

        // Save to a temporary .png file
        const tmpFile = path.join(os.tmpdir(), `${productId}.png`);
        fs.writeFileSync(tmpFile, pngBuffer);

        // 3️⃣ Build FormData payload
        const form = new FormData();
        form.append("model", "gpt-image-1");
        form.append("prompt", imagePrompt);
        form.append("size", "1024x1024");
        form.append("image", fs.createReadStream(tmpFile), {
            filename: `${productId}.png`,
            contentType: "image/png", // ✅ Force correct MIME type
        });

        // 4️⃣ Send request directly to OpenAI Images API (force correct org context)
        const headers = {
            ...form.getHeaders(), // include multipart boundaries
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "OpenAI-Organization": process.env.OPENAI_ORG_ID, // 👈 required for verified orgs
        };

        const openaiResp = await fetch("https://api.openai.com/v1/images/edits", {
            method: "POST",
            headers,
            body: form,
        });

        const data = await openaiResp.json();

        if (!data?.data?.[0]?.b64_json) {
            console.error("❌ OpenAI returned invalid response:", data);
            return res.status(500).json({ error: "OpenAI did not return valid image data" });
        }

        const generatedBuffer = Buffer.from(data.data[0].b64_json, "base64");

        // 5️⃣ Upload new image to Firebase Storage
        const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
        const filePath = `generated_ads/${businessId}/${productId}.png`;
        const file = bucket.file(filePath);

        await file.save(generatedBuffer, {
            metadata: { contentType: "image/png" },
            public: true,
        });

        const publicUrl = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${filePath}`;

        // 6️⃣ Update Firestore
        await productRef.set(
            {
                generatedImageUrl: publicUrl,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        // 7️⃣ Respond
        res.json({
            success: true,
            message: `Generated advertisement image for product ${productId}`,
            generatedImageUrl: publicUrl,
        });
    } catch (err) {
        console.error("❌ Error generating ad image:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});