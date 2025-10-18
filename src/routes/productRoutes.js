/**
 * 🔐 Product Routes with Firebase-Only Authentication
 * 
 * All routes use Firebase ID tokens verified by middleware.
 * Data structure: /users/{uid}/businesses/{businessId}/products/{productId}
 * Security: req.user.uid from verified Firebase token ensures user owns the data
 */

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const admin = require("firebase-admin");
const { db } = require("../config/firebase");
const { verifyAccessToken } = require("../middleware/authMiddleware");
const { createProduct } = require("../models/ProductModel");
const { createBusiness } = require("../models/BusinessModel");
const { STATUS } = require("../constants/statusEnum");

// ------------------------------------------------------------------
// Upload single image to Firebase Storage — replaces old ones
// ------------------------------------------------------------------
const multer = require("multer");
const { getStorage } = require("firebase-admin/storage");
const upload = multer({ storage: multer.memoryStorage() });
const path = require("path");

router.post(
  "/upload/:businessId/:productId",
  verifyAccessToken,
  upload.single("file"),
  async (req, res) => {
    try {
      const uid = req.user.uid;
      const { businessId, productId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, error: "No file provided" });
      }

      const storage = getStorage();
      const bucket = storage.bucket();

      // 🧹 1️⃣ Delete any existing files in the product folder
      const prefix = `users/${uid}/businesses/${businessId}/products/${productId}/`;
      const [existingFiles] = await bucket.getFiles({ prefix });
      for (const f of existingFiles) {
        await f.delete().catch(() => null);
      }

      // 📸 2️⃣ Upload the new image
      const newFilePath = `${prefix}${Date.now()}-${file.originalname}`;
      const fileRef = bucket.file(newFilePath);

      await fileRef.save(file.buffer, {
        metadata: { contentType: file.mimetype },
        resumable: false,
      });

      // 🔗 3️⃣ Generate signed URL
      const [url] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-09-2030",
      });

      // 💾 4️⃣ Save image URL in Firestore
      const productRef = db
        .collection("users")
        .doc(uid)
        .collection("businesses")
        .doc(businessId)
        .collection("products")
        .doc(productId);

      await productRef.set({ imageUrl: url }, { merge: true });

      res.json({ success: true, url });
    } catch (err) {
      console.error("❌ Error uploading image:", err);
      res.status(500).json({ success: false, error: "Failed to upload image" });
    }
  }
);
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
      batch.set(
        productRef,
        createProduct({ id: productId, ...product, status: STATUS.PENDING }),
        { merge: true }
      );
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

    // ✅ Instead of isPosted/isEnriched, use unified status
    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("businesses")
      .doc(businessId)
      .collection("products")
      .where("status", "==", STATUS.PENDING)
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
// Update ANY product field(s) dynamically
// ------------------------------------------------------------------
router.patch("/update/:businessId/:productId", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { businessId, productId } = req.params;
    const updates = req.body; // dynamic fields to update

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: "No update fields provided" });
    }

    if (updates.status) {
      console.log(`[Product] ${productId} → status set to ${updates.status}`);
    }

    const productRef = db
      .collection("users")
      .doc(uid)
      .collection("businesses")
      .doc(businessId)
      .collection("products")
      .doc(productId);

    // Merge only provided fields
    await productRef.set(
      {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const updatedDoc = await productRef.get();

    // 🔔 Emit to all clients (you can later scope by room/user)
    try {
      const io = req.app.get("io");
      io?.emit("product:update", {
        id: productId,
        businessId,
        ...updatedDoc.data(),
      });
    } catch (_) {}

    res.json({
      success: true,
      message: `✅ Product ${productId} updated successfully`,
      product: { id: productId, ...updatedDoc.data() },
    });
  } catch (err) {
    console.error("❌ Error updating product:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});


// ------------------------------------------------------------------
// Create a single product for a business
// ------------------------------------------------------------------
router.post("/:businessId", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { businessId } = req.params;
    const product = req.body;

    if (!product?.name) {
      return res.status(400).json({ success: false, error: "Missing product name" });
    }

    const productId =
      product.id ||
      crypto.createHash("md5").update(product.name + Date.now()).digest("hex");

    const productRef = db
      .collection("users")
      .doc(uid)
      .collection("businesses")
      .doc(businessId)
      .collection("products")
      .doc(productId);

    const newProduct = createProduct({
      id: productId,
      businessId,
      ...product,
      status: STATUS.PENDING,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await productRef.set(newProduct, { merge: true });

    const saved = await productRef.get();
    res.json({
      success: true,
      message: "✅ Product created successfully",
      product: { id: productId, ...saved.data() },
    });
  } catch (err) {
    console.error("❌ Error creating product:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});
// ------------------------------------------------------------------
// Delete product completely (Firestore + Storage folder)
// ------------------------------------------------------------------
router.delete("/:businessId/:productId", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { businessId, productId } = req.params;

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

    // 🧹 1️⃣ Delete the Firestore document
    await productRef.delete();

    // 🧹 2️⃣ Delete the folder from Firebase Storage
    const storage = getStorage();
    const bucket = storage.bucket();
    const prefix = `users/${uid}/businesses/${businessId}/products/${productId}/`;

    const [files] = await bucket.getFiles({ prefix });
    for (const file of files) {
      await file.delete().catch(() => null);
    }

    res.json({
      success: true,
      message: `🗑️ Product ${productId} deleted completely.`,
    });
  } catch (err) {
    console.error("❌ Error deleting product:", err);
    res.status(500).json({ success: false, error: "Failed to delete product" });
  }
});


/**
 * TODO:
 * - Update the ad posting logic (in AI routes or workflows) to set:
 *     status = "posted"
 *   instead of toggling isPosted.
 * - Update any n8n workflows that rely on isPosted/isEnriched filters.
 */

module.exports = router;
