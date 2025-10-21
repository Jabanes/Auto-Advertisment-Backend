/**
 * 🔐 Business Routes with Firebase-Only Authentication
 *
 * All routes use Firebase ID tokens verified by middleware.
 * Data structure: /users/{uid}/businesses/{businessId}
 * Security: req.user.uid from verified Firebase token ensures user owns the data
 */

const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { db } = require("../config/firebase");
const { verifyAccessToken } = require("../middleware/authMiddleware");
const { createBusiness } = require("../models/BusinessModel");

// ------------------------------------------------------------------
// GET ALL BUSINESSES for a user
// ------------------------------------------------------------------
router.get("/", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const businessesRef = db.collection("users").doc(uid).collection("businesses");
    const snapshot = await businessesRef.get();

    if (snapshot.empty) {
      return res.json({ success: true, businesses: [] });
    }

    // Map docs and ensure businessId is set (already in data, but verify consistency)
    const businesses = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        businessId: data.businessId || doc.id, // Ensure businessId exists
      };
    });
    
    res.json({ success: true, businesses });
  } catch (err) {
    console.error("❌ Error fetching businesses:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ------------------------------------------------------------------
// GET A SINGLE BUSINESS by ID
// ------------------------------------------------------------------
router.get("/:businessId", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { businessId } = req.params;

    const businessRef = db.collection("users").doc(uid).collection("businesses").doc(businessId);
    const doc = await businessRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: "Business not found" });
    }

    const data = doc.data();
    const business = {
      ...data,
      businessId: data.businessId || doc.id, // Ensure businessId exists
    };

    res.json({ success: true, business });
  } catch (err) {
    console.error("❌ Error fetching business:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ------------------------------------------------------------------
// CREATE A NEW BUSINESS
// ------------------------------------------------------------------
router.post("/", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const businessData = req.body;

    if (!businessData.name) {
      return res.status(400).json({ success: false, error: "Business name is required" });
    }

    const businessesRef = db.collection("users").doc(uid).collection("businesses");
    const newBusinessRef = businessesRef.doc(); // Auto-generate ID

    // Create business with all fields from request body
    const newBusiness = createBusiness({
      businessId: newBusinessRef.id,
      ...businessData, // Spread all fields from request
    });

    await newBusinessRef.set(newBusiness);

    const createdDoc = await newBusinessRef.get();
    const createdBusiness = {
      ...createdDoc.data(),
      businessId: newBusinessRef.id, // Ensure businessId is present
    };

    // 🔔 Emit socket event
    try {
      const io = req.app.get("io");
      io?.to(`user:${uid}`).emit("business:created", createdBusiness);
      console.log(`📡 Emitted business:created for ${createdBusiness.businessId}`);
    } catch (err) {
      console.warn("⚠️ Failed to emit socket event:", err.message);
    }

    res.status(201).json({ success: true, message: "Business created successfully", business: createdBusiness });
  } catch (err) {
    console.error("❌ Error creating business:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ------------------------------------------------------------------
// UPDATE A BUSINESS
// ------------------------------------------------------------------
router.patch("/:businessId", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { businessId } = req.params;
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: "No update fields provided" });
    }

    const businessRef = db.collection("users").doc(uid).collection("businesses").doc(businessId);

    await businessRef.update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updatedDoc = await businessRef.get();
    const data = updatedDoc.data();
    const updatedBusiness = {
      ...data,
      businessId: data.businessId || updatedDoc.id, // Ensure businessId exists
    };

    // 🔔 Emit socket event
    try {
      const io = req.app.get("io");
      io?.to(`user:${uid}`).emit("business:updated", updatedBusiness);
      console.log(`📡 Emitted business:updated for ${updatedBusiness.businessId}`);
    } catch (err) {
      console.warn("⚠️ Failed to emit socket event:", err.message);
    }

    res.json({ success: true, message: "Business updated successfully", business: updatedBusiness });
  } catch (err) {
    console.error("❌ Error updating business:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ------------------------------------------------------------------
// DELETE A BUSINESS
// ------------------------------------------------------------------
router.delete("/:businessId", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { businessId } = req.params;

    // TODO: Add logic to delete subcollections (products) if necessary
    const businessRef = db.collection("users").doc(uid).collection("businesses").doc(businessId);
    await businessRef.delete();

    // 🔔 Emit socket event
    try {
      const io = req.app.get("io");
      // Frontend expects { businessId } not { id }
      io?.to(`user:${uid}`).emit("business:deleted", { businessId });
      console.log(`📡 Emitted business:deleted for ${businessId}`);
    } catch (err) {
      console.warn("⚠️ Failed to emit socket event:", err.message);
    }

    res.json({ success: true, message: "Business deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting business:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;