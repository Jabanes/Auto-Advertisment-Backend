const express = require("express");
const { db } = require("../config/firebase");
const { verifyAccessToken } = require("../middleware/auth");
const router = express.Router();

// Create or update a business
router.post("/", verifyAccessToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    const businessId = db.collection("businesses").doc().id;
    const now = new Date();

    const businessData = {
      id: businessId,
      name,
      description: description || "",
      ownerId: req.user.uid,
      members: [req.user.uid],
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("businesses").doc(businessId).set(businessData);
    res.json({ success: true, business: businessData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all businesses for current user
router.get("/", verifyAccessToken, async (req, res) => {
  const snapshot = await db
    .collection("businesses")
    .where("ownerId", "==", req.user.uid)
    .get();

  const businesses = snapshot.docs.map((doc) => doc.data());
  res.json({ success: true, businesses });
});

module.exports = router;
