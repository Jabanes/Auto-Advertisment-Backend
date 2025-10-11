/**
 * Firebase Admin configuration for Auto-Advertisement Backend
 * Extracted from original index.js to maintain modular structure.
 */

const admin = require("firebase-admin");
const path = require("path");

// Load service account (adjust path to root)
const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Export Firestore + Storage references for global use
const db = admin.firestore();
const storage = admin.storage();

// Export everything
module.exports = {
  admin,
  db,
  storage,
  serviceAccount,
};
