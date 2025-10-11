/**
 * Product Routes — uses the new nested structure:
 * /users/{uid}/businesses/{businessId}/products/{productId}
 */

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const admin = require("firebase-admin");
const { db } = require("../config/firebase");
const { verifyAccessToken } = require("../middleware/authMiddleware");
const { createProduct } = require("../models/ProductModel");
const { createBusiness } = require("../models/BusinessModel");

// ------------------------------------------------------------------
// Upload products for a business (under a user)
// ------------------------------------------------------------------
router.post("/upload", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    let { businessId, businessInfo, products } = req.body;

    if (!uid || !businessId || !products) {
      return res.status(400).json({
        success: false,
        error: "Missing uid, businessId, or products",
      });
    }

    if (typeof businessInfo === "string") {
      try {
        businessInfo = JSON.parse(businessInfo);
      } catch {
        businessInfo = {};
      }
    }

    if (!Array.isArray(products)) {
      products = [products];
    }

    const userRef = db.collection("users").doc(uid);
    const businessRef = userRef.collection("businesses").doc(businessId);

    await businessRef.set(createBusiness({ businessId, ...businessInfo }), { merge: true });

    const batch = db.batch();

    products.forEach((product) => {
      const productId =
        product.id || crypto.createHash("md5").update(product.name || product.Name || "unnamed").digest("hex");
      const productRef = businessRef.collection("products").doc(productId);
      batch.set(productRef, createProduct({ id: productId, ...product }), { merge: true });
    });

    await batch.commit();

    res.json({
      success: true,
      message: `Saved ${products.length} products for user ${uid}, business ${businessId}`,
      businessId,
      savedCount: products.length,
    });
  } catch (err) {
    console.error("❌ Error saving products:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ------------------------------------------------------------------
// Get next product for enrichment
// ------------------------------------------------------------------
router.get("/next/:businessId", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { businessId } = req.params;

    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("businesses")
      .doc(businessId)
      .collection("products")
      .where("isPosted", "==", false)
      .where("isEnriched", "==", false)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ success: false, error: "No pending products" });
    }

    const doc = snapshot.docs[0];
    res.json({ success: true, businessId, productId: doc.id, ...doc.data() });
  } catch (err) {
    console.error("❌ Error fetching next product:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ------------------------------------------------------------------
// Update product advertisement or enrichment info
// ------------------------------------------------------------------
router.post("/update/:businessId/:productId", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { businessId, productId } = req.params;
    const { advertisementText, imagePrompt } = req.body;

    const productRef = db
      .collection("users")
      .doc(uid)
      .collection("businesses")
      .doc(businessId)
      .collection("products")
      .doc(productId);

    await productRef.set(
      {
        advertisementText: advertisementText || null,
        imagePrompt: imagePrompt || null,
        isEnriched: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.json({ success: true, message: `Updated product ${productId}` });
  } catch (err) {
    console.error("❌ Error updating product:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;
