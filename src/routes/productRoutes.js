const express = require("express");
const { db, admin } = require("../config/firebase");
const { verifyAccessToken } = require("../middleware/auth");
const router = express.Router();

// Upload multiple products
router.post("/", verifyAccessToken, async (req, res) => {
  try {
    const { businessId, products } = req.body;
    const now = admin.firestore.FieldValue.serverTimestamp();

    const batch = db.batch();

    products.forEach((p) => {
      const id = p.id || db.collection("products").doc().id;
      const ref = db.collection("products").doc(id);
      batch.set(ref, {
        ...p,
        id,
        businessId,
        createdAt: now,
        updatedAt: now,
      });
    });

    await batch.commit();
    res.json({ success: true, count: products.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get products by business
router.get("/:businessId", verifyAccessToken, async (req, res) => {
  const { businessId } = req.params;
  const snapshot = await db
    .collection("products")
    .where("businessId", "==", businessId)
    .get();
  res.json({ success: true, products: snapshot.docs.map((d) => d.data()) });
});

module.exports = router;
