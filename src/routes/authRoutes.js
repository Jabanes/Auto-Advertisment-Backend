/**
 * src/routes/authRoutes.js
 * Handles all authentication endpoints (register, login, google, refresh, logout, verify)
 */

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { admin, db } = require("../config/firebase");
const { generateAccessToken, generateRefreshToken } = require("../services/jwtService");

const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

// -------------------------------------------------------------------
// 🔐 GOOGLE SIGN-IN
// -------------------------------------------------------------------
router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: "Missing idToken",
        code: "auth/missing-id-token",
      });
    }

    let decoded;
    try {
      // Try verifying as Firebase token
      decoded = await admin.auth().verifyIdToken(idToken);
      console.log("✅ Firebase ID token verified.");
    } catch (firebaseErr) {
      // Fallback to Google OAuth verification
      console.log("ℹ️ Falling back to Google OAuth verification...");
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_WEB_CLIENT_ID,
      });
      decoded = ticket.getPayload();
    }

    const { sub, email, name, picture } = decoded;
    const uid = decoded.uid || sub;
    const displayName = name || "Google User";
    const photoURL = picture || null;
    const emailVerified = decoded.email_verified ?? true;

    console.log("✅ Google token verified for:", email);

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!userDoc.exists) {
      console.log("🆕 Creating Firestore user for:", email);
      await userRef.set({
        uid,
        email,
        displayName,
        photoURL,
        provider: "google.com",
        emailVerified,
        createdAt: now,
        lastLoginAt: now,
      });
    } else {
      console.log("🔁 Updating last login for:", email);
      await userRef.update({ lastLoginAt: now });
    }

    const accessToken = generateAccessToken(uid);
    const refreshToken = generateRefreshToken(uid);

    const user = { uid, email, displayName, photoURL, emailVerified, provider: "google.com" };

    res.status(200).json({
      success: true,
      message: "Google Sign-In successful",
      user,
      accessToken,
      refreshToken,
    });

    console.log("🚀 Google Sign-In flow completed for:", email);
  } catch (err) {
    console.error("❌ Google Sign-In failed:", err);
    res.status(401).json({
      success: false,
      error: "Invalid or expired Google token",
      message: err.message,
      code: "auth/invalid-id-token",
    });
  }
});

module.exports = router;
