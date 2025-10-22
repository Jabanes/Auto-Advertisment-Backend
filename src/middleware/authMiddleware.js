/**
 * 🔐 Firebase-Only Authentication Middleware
 * 
 * Verifies Firebase ID tokens using Admin SDK.
 * No custom JWTs - only Firebase-issued tokens.
 */

const { admin } = require("../config/firebase");

/**
 * Middleware to verify Firebase ID token
 * Extracts uid from verified token and attaches to req.user
 */
async function verifyAccessToken(req, res, next) {
  console.log("[Auth] Verifying Firebase ID token...");
  
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log("[Auth] ❌ Missing Authorization header");
    return res.status(401).json({ 
      success: false, 
      error: "Missing Authorization header" 
    });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    console.log("[Auth] ❌ No token found in Authorization header");
    return res.status(401).json({ 
      success: false, 
      error: "No token provided" 
    });
  }

  try {
    console.log("[Auth] Calling admin.auth().verifyIdToken()...");
    
    // Verify Firebase ID token using Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    console.log("[Auth] ✅ Token verified successfully");
    console.log("[Auth] User ID:", decodedToken.uid);
    console.log("[Auth] Email:", decodedToken.email);
    
    // Attach decoded token to request
    // Contains: uid, email, email_verified, auth_time, etc.
    req.user = decodedToken;
    
    next();
  } catch (error) {
    console.error("[Auth] ❌ Token verification failed:", error.message);
    return res.status(401).json({ 
      success: false, 
      error: "Invalid or expired Firebase token",
      details: error.message
    });
  }
}

module.exports = { verifyAccessToken };
