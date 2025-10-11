/**
 * UserModel — defines the Firestore schema for user documents
 */

const admin = require("firebase-admin");

const UserFields = {
  uid: null,
  email: null,
  displayName: null,
  photoURL: null,
  provider: null,
  emailVerified: false,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
};

function createUser({
  uid,
  email,
  displayName = null,
  photoURL = null,
  provider = "email",
  emailVerified = false,
}) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  return {
    ...UserFields,
    uid,
    email,
    displayName,
    photoURL,
    provider,
    emailVerified,
    createdAt: now,
    lastLoginAt: now,
  };
}

module.exports = { UserFields, createUser };
