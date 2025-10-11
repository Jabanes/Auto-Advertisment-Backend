/**
 * Business Routes — consistent with new structure:
 * /users/{uid}/businesses/{businessId}
 */

const express = require("express");
const { db } = require("../config/firebase");
const { verifyAccessToken } = require("../middleware/authMiddleware"); // use the same naming everywhere
const { createBusiness } = require("../models/BusinessModel");

const router = express.Router();

// --------------------------------------------------
// Create or update a business under current user
// --------------------------------------------------
router.post("/", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { name, description = "", category = "" } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: "Business name is required" });
    }

    // Generate new business ID under the user
    const businessId = db.collection("users").doc(uid).collection("businesses").doc().id;

    const businessData = createBusiness({
      businessId,
      name,
      description,
      category,
    });

    await db
      .collection("users")
      .doc(uid)
      .collection("businesses")
      .doc(businessId)
      .set(businessData);

    res.json({ success: true, business: businessData });
  } catch (err) {
    console.error("❌ Error creating business:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------
// Get all businesses for current user
// --------------------------------------------------
router.get("/", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    const snapshot = await db.collection("users").doc(uid).collection("businesses").get();

    const businesses = snapshot.docs.map((doc) => ({
      businessId: doc.id,
      ...doc.data(),
    }));

    res.json({ success: true, businesses });
  } catch (err) {
    console.error("❌ Error fetching businesses:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------
// Get a single business with products
// --------------------------------------------------
router.get("/:businessId", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { businessId } = req.params;

    const businessRef = db.collection("users").doc(uid).collection("businesses").doc(businessId);
    const businessDoc = await businessRef.get();

    if (!businessDoc.exists) {
      return res.status(404).json({ success: false, error: "Business not found" });
    }

    // Optionally fetch products inside this business
    const productsSnapshot = await businessRef.collection("products").get();
    const products = productsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    res.json({
      success: true,
      business: businessDoc.data(),
      products,
    });
  } catch (err) {
    console.error("❌ Error fetching business details:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
