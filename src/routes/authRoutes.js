/**
 * src/routes/authRoutes.js
 * Handles all authentication endpoints (register, login, google, refresh, logout, verify)
 */

const express = require("express");
const router = express.Router();
const { admin, db } = require("../config/firebase");
const { generateAccessToken, generateRefreshToken } = require("../services/jwtService");
const { verifyAccessToken } = require("../middleware/authMiddleware");
const { createUser } = require("../models/UserModel");
const { createBusiness } = require("../models/BusinessModel");
const { createProduct } = require("../models/ProductModel");
const jwt = require("jsonwebtoken");

// -------------------------------------------------------------------
// 🔧 HELPER: Fetch user data with businesses and products
// -------------------------------------------------------------------
async function fetchUserFullData(uid) {
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new Error("User not found");
  }

  const userData = userDoc.data();

  // Fetch all businesses
  const businessesSnap = await userRef.collection("businesses").get();
  const businesses = businessesSnap.docs.map(doc => ({
    businessId: doc.id,
    ...doc.data(),
  }));

  // Fetch all products across all businesses
  let products = [];
  for (const business of businesses) {
    const productsSnap = await userRef
      .collection("businesses")
      .doc(business.businessId)
      .collection("products")
      .get();

    const businessProducts = productsSnap.docs.map(pDoc => ({
      id: pDoc.id,
      businessId: business.businessId,
      ...pDoc.data(),
    }));
    products = products.concat(businessProducts);
  }

  return {
    user: {
      uid: userData.uid,
      email: userData.email,
      displayName: userData.displayName || null,
      photoURL: userData.photoURL || null,
      emailVerified: userData.emailVerified || false,
      provider: userData.provider || "email",
      createdAt: userData.createdAt,
      lastLoginAt: userData.lastLoginAt,
    },
    businesses,
    products,
  };
}

// -------------------------------------------------------------------
// 📝 REGISTER (Email + Password)
// -------------------------------------------------------------------
router.post("/register", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }

    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: displayName || email.split("@")[0],
    });

    const uid = userRecord.uid;

    // Create Firestore user document
    const userRef = db.collection("users").doc(uid);
    const userData = createUser({
      uid,
      email,
      displayName: displayName || email.split("@")[0],
      photoURL: null,
      provider: "email",
      emailVerified: false,
    });
    await userRef.set(userData);

    // Create default business
    const businessId = userRef.collection("businesses").doc().id;
    const businessData = createBusiness({
      businessId,
      name: `${(displayName || email.split("@")[0])}'s Business`,
      description: "Your default business workspace",
    });
    await userRef.collection("businesses").doc(businessId).set(businessData);

    // Create sample product
    const productId = userRef.collection("businesses").doc(businessId).collection("products").doc().id;
    const productData = createProduct({
      id: productId,
      name: "Sample Product",
      price: 0,
      description: "This is your first demo product.",
    });
    await userRef.collection("businesses").doc(businessId).collection("products").doc(productId).set(productData);

    // Generate tokens
    const accessToken = generateAccessToken(uid);
    const refreshToken = generateRefreshToken(uid);

    // Fetch full user data
    const fullData = await fetchUserFullData(uid);

    res.json({
      success: true,
      message: "Registration successful",
      uid,
      email,
      accessToken,
      refreshToken,
      ...fullData,
    });
  } catch (err) {
    console.error("❌ Registration failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------------
// 🔐 LOGIN (Email + Password)
// -------------------------------------------------------------------
// Note: Frontend should authenticate with Firebase Client SDK first,
// then send the ID token here (similar to Google login)
router.post("/login", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, error: "ID token is required" });
    }

    // Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email;

    // Update last login
    const userRef = db.collection("users").doc(uid);
    await userRef.update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Generate tokens
    const accessToken = generateAccessToken(uid);
    const refreshToken = generateRefreshToken(uid);

    // Fetch full user data
    const fullData = await fetchUserFullData(uid);

    res.json({
      success: true,
      message: "Login successful",
      uid,
      email,
      accessToken,
      refreshToken,
      ...fullData,
    });
  } catch (err) {
    console.error("❌ Login failed:", err);
    res.status(401).json({ success: false, error: "Invalid credentials" });
  }
});

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

    // Generate tokens
    const accessToken = generateAccessToken(uid);
    const refreshToken = generateRefreshToken(uid);

    // Fetch full user data
    const fullData = await fetchUserFullData(uid);

    res.json({
      success: true,
      message: "Google Sign-In successful",
      uid,
      email,
      accessToken,
      refreshToken,
      ...fullData,
    });
  } catch (err) {
    console.error("❌ Google Sign-In failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------------
// 🔄 REFRESH TOKEN
// -------------------------------------------------------------------
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, error: "Refresh token is required" });
    }

    // Verify refresh token
    const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";
    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    if (decoded.type !== "refresh") {
      return res.status(401).json({ success: false, error: "Invalid refresh token" });
    }

    const uid = decoded.uid;

    // Generate new tokens
    const newAccessToken = generateAccessToken(uid);
    const newRefreshToken = generateRefreshToken(uid);

    // Fetch updated user data
    const fullData = await fetchUserFullData(uid);

    res.json({
      success: true,
      message: "Token refreshed successfully",
      uid,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      ...fullData,
    });
  } catch (err) {
    console.error("❌ Token refresh failed:", err);
    res.status(401).json({ success: false, error: "Invalid or expired refresh token" });
  }
});

// -------------------------------------------------------------------
// 🚪 LOGOUT
// -------------------------------------------------------------------
router.post("/logout", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // Optionally, invalidate the token in a blacklist (not implemented here)
    // For now, just return success - client will clear tokens locally
    
    console.log(`✅ User ${uid} logged out`);
    
    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (err) {
    console.error("❌ Logout failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------------
// 🔍 VERIFY TOKEN
// -------------------------------------------------------------------
router.get("/verify", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // If we got here, token is valid (middleware verified it)
    const fullData = await fetchUserFullData(uid);
    
    res.json({
      success: true,
      message: "Token is valid",
      uid,
      ...fullData,
    });
  } catch (err) {
    console.error("❌ Token verification failed:", err);
    res.status(401).json({ success: false, error: "Invalid token" });
  }
});

module.exports = router;
