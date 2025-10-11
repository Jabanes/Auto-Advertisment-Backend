/**
 * src/routes/authRoutes.js
 * Handles all authentication endpoints (register, login, google, refresh, logout, verify)
 */

const express = require("express");
const router = express.Router();
const { admin, db } = require("../config/firebase");
const { generateAccessToken, generateRefreshToken } = require("../services/jwtService");
const { createUser } = require("../models/UserModel");
const { createBusiness } = require("../models/BusinessModel");
const { createProduct } = require("../models/ProductModel");

// -------------------------------------------------------------------
// 🔐 GOOGLE SIGN-IN
// -------------------------------------------------------------------
router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, error: "Missing idToken" });
    }

    // Verify Google ID token
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email;
    const name = decoded.name || "User";
    const picture = decoded.picture || null;

    // Ensure user exists in Firebase Authentication
    let userRecord;
    try {
      userRecord = await admin.auth().getUser(uid);
    } catch (e) {
      userRecord = await admin.auth().createUser({
        uid,
        email,
        displayName: name,
        photoURL: picture,
      });
    }

    // Create user doc if missing
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      const userData = createUser({
        uid,
        email,
        displayName: name,
        photoURL: picture,
        provider: "google.com", // Or extract from decoded.firebase.sign_in_provider
      });
      await userRef.set(userData, { merge: true });

      // Create default business
      const businessId = db.collection("users").doc(uid).collection("businesses").doc().id;
      const businessData = createBusiness({
        businessId,
        name: `${name.split(" ")[0]}'s Business`,
        description: "Your default business workspace",
      });

      await userRef.collection("businesses").doc(businessId).set(businessData);

      // Create default sample product
      const productId = db.collection("users").doc(uid).collection("businesses").doc(businessId).collection("products").doc().id;

      const productData = createProduct({
        id: productId,
        name: "Sample Product",
        price: 0,
        description: "This is your first demo product.",
      });

      await userRef.collection("businesses").doc(businessId).collection("products").doc(productId).set(productData);
    }

    const accessToken = generateAccessToken(uid);
    const refreshToken = generateRefreshToken(uid);

    // Return success
    res.json({
      success: true,
      message: "Google Sign-In successful",
      uid,
      email,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("❌ Google Sign-In failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
