/**
 * 🔐 Unified Firebase Authentication Routes
 * 
 * All routes use Firebase ID tokens verified by Admin SDK.
 * No custom JWT generation - Firebase handles all token lifecycle.
 */

const express = require("express");
const router = express.Router();
const { admin, db } = require("../config/firebase");
const { verifyAccessToken } = require("../middleware/authMiddleware");
const { createUser } = require("../models/UserModel");
const { createBusiness } = require("../models/BusinessModel");
const { createProduct } = require("../models/ProductModel");

// -------------------------------------------------------------------
// 🔧 HELPER: Fetch user data with businesses and products
// -------------------------------------------------------------------
async function fetchUserFullData(uid) {
  console.log(`[Auth] Fetching full data for user: ${uid}`);
  
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new Error("User not found in Firestore");
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

  console.log(`[Auth] Fetched ${businesses.length} businesses and ${products.length} products`);

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
// Client should register with Firebase Client SDK, then send ID token
// -------------------------------------------------------------------
router.post("/register", async (req, res) => {
  try {
    console.log("[Auth] POST /auth/register");
    const { idToken, displayName } = req.body;

    if (!idToken) {
      return res.status(400).json({ 
        success: false, 
        error: "Firebase ID token is required" 
      });
    }

    // Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email;

    console.log(`[Auth] Registering user: ${email} (${uid})`);

    // Check if user already exists
    const userRef = db.collection("users").doc(uid);
    const existingUser = await userRef.get();

    if (existingUser.exists) {
      console.log(`[Auth] User already exists, returning existing data`);
      const fullData = await fetchUserFullData(uid);
      return res.json({
        success: true,
        message: "User already registered",
        uid,
        email,
        idToken, // Return the same Firebase token
        ...fullData,
      });
    }

    // Create Firestore user document
    const userData = createUser({
      uid,
      email,
      displayName: displayName || email.split("@")[0],
      photoURL: null,
      provider: "email",
      emailVerified: decoded.email_verified || false,
    });
    await userRef.set(userData);
    console.log(`[Auth] Created user document in Firestore`);

    // Create default business
    const businessId = userRef.collection("businesses").doc().id;
    const businessData = createBusiness({
      businessId,
      name: `${(displayName || email.split("@")[0])}'s Business`,
      description: "Your default business workspace",
    });
    await userRef.collection("businesses").doc(businessId).set(businessData);
    console.log(`[Auth] Created default business: ${businessId}`);

    // Create sample product
    const productId = userRef.collection("businesses").doc(businessId).collection("products").doc().id;
    const productData = createProduct({
      id: productId,
      name: "Sample Product",
      price: 0,
      description: "This is your first demo product.",
    });
    await userRef.collection("businesses").doc(businessId).collection("products").doc(productId).set(productData);
    console.log(`[Auth] Created sample product: ${productId}`);

    // Fetch full user data
    const fullData = await fetchUserFullData(uid);

    console.log(`[Auth] ✅ Registration successful for ${email}`);

    res.json({
      success: true,
      message: "Registration successful",
      uid,
      email,
      idToken, // Return the same Firebase token (client already has it)
      ...fullData,
    });
  } catch (err) {
    console.error("❌ Registration failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------------
// 🔐 GET USER DATA (Verify Token + Fetch Data)
// Used for: Initial load, token validation, data refresh
// -------------------------------------------------------------------
router.get("/me", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    console.log(`[Auth] GET /auth/me for user: ${uid}`);

    // Update last login timestamp
    const userRef = db.collection("users").doc(uid);
    await userRef.update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Fetch full user data
    const fullData = await fetchUserFullData(uid);

    console.log(`[Auth] ✅ User data fetched successfully`);

    res.json({
      success: true,
      uid,
      email: req.user.email,
      ...fullData,
    });
  } catch (err) {
    console.error("❌ Failed to fetch user data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------------
// 🔐 GOOGLE SIGN-IN / INITIAL SETUP
// Client authenticates with Firebase, sends ID token to setup profile
// -------------------------------------------------------------------
router.post("/google", async (req, res) => {
  try {
    console.log("[Auth] POST /auth/google");
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ 
        success: false, 
        error: "Firebase ID token is required" 
      });
    }

    // Verify Google ID token via Firebase Admin
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email;
    const name = decoded.name || "User";
    const picture = decoded.picture || null;

    console.log(`[Auth] Google Sign-In: ${email} (${uid})`);

    // Check if user already exists in Firestore
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`[Auth] First-time Google user, creating profile...`);
      
      // Create user document
      const userData = createUser({
        uid,
        email,
        displayName: name,
        photoURL: picture,
        provider: "google.com",
        emailVerified: decoded.email_verified || false,
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
      
      console.log(`[Auth] Created default business and sample product`);
    } else {
      console.log(`[Auth] Existing Google user, updating last login`);
      await userRef.update({
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Fetch full user data
    const fullData = await fetchUserFullData(uid);

    console.log(`[Auth] ✅ Google Sign-In successful`);

    res.json({
      success: true,
      message: "Google Sign-In successful",
      uid,
      email,
      idToken, // Return the same Firebase token
      ...fullData,
    });
  } catch (err) {
    console.error("❌ Google Sign-In failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------------
// 🚪 LOGOUT
// -------------------------------------------------------------------
router.post("/logout", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    console.log(`[Auth] POST /auth/logout for user: ${uid}`);
    
    // No server-side token invalidation needed with Firebase
    // Client will call Firebase auth.signOut() and clear local storage
    
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
// 🔍 VERIFY TOKEN (Health check for authentication)
// -------------------------------------------------------------------
router.get("/verify", verifyAccessToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    console.log(`[Auth] GET /auth/verify for user: ${uid}`);
    
    // If we got here, token is valid (middleware verified it)
    const fullData = await fetchUserFullData(uid);
    
    console.log(`[Auth] ✅ Token verified successfully`);
    
    res.json({
      success: true,
      message: "Firebase token is valid",
      uid,
      ...fullData,
    });
  } catch (err) {
    console.error("❌ Token verification failed:", err);
    res.status(401).json({ success: false, error: "Invalid token" });
  }
});

// -------------------------------------------------------------------
// ℹ️  NOTE: No /refresh endpoint needed
// Firebase Client SDK handles token refresh automatically via getIdToken(true)
// -------------------------------------------------------------------

module.exports = router;
