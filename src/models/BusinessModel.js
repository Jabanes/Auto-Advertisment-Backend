/**
 * BusinessModel — defines the Firestore schema for business documents
 */

const admin = require("firebase-admin");

const BusinessFields = {
  businessId: null,
  name: null,
  description: null,
  category: null,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

function createBusiness({ businessId, name, description = "", category = "" }) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  return {
    ...BusinessFields,
    businessId,
    name,
    description,
    category,
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = { BusinessFields, createBusiness };
