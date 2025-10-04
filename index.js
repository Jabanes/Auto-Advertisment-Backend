require("dotenv").config(); // Load environment variables from .env file

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const crypto = require("crypto");

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
