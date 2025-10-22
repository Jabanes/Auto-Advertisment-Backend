const { OAuth2Client } = require("google-auth-library");
const { GOOGLE_WEB_CLIENT_ID } = require("../config/env");
const { admin, db } = require("../config/firebase");
const { generateAccessToken, generateRefreshToken } = require("./jwtService");

const googleClient = new OAuth2Client(GOOGLE_WEB_CLIENT_ID);

async function handleGoogleSignIn(idToken) {
  let decoded;

  try {
    // Try verifying as Firebase token first
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    // Fall back to Google OAuth
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_WEB_CLIENT_ID });
    decoded = ticket.getPayload();
  }

  const { sub, email, name, picture } = decoded;
  const uid = decoded.uid || sub;
  const displayName = name || "Google User";
  const photoURL = picture || null;
  const emailVerified = decoded.email_verified ?? true;

  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();
  const now = admin.firestore.FieldValue.serverTimestamp();

  if (!userDoc.exists) {
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
    await userRef.update({ lastLoginAt: now });
  }

  const accessToken = generateAccessToken(uid);
  const refreshToken = generateRefreshToken(uid);

  return {
    uid,
    email,
    displayName,
    photoURL,
    emailVerified,
    provider: "google.com",
    accessToken,
    refreshToken,
  };
}

module.exports = { handleGoogleSignIn };
