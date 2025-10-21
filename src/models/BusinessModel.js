/**
 * BusinessModel — defines the Firestore schema for business documents
 */

const admin = require("firebase-admin");

const BusinessFields = {
  businessId: null,
  name: null,
  description: null,
  logoUrl: null,
  address: null,         // expected object { street?, city?, postalCode?, country? }
  contactPhone: null,
  businessEmail: null,
  websiteUrl: null,
  owner: null,           // expected object { name?, email?, phone? }
  brandColors: null,     // expected array of HEX strings
  preferredStyle: null,  // "realistic" | "illustrated" | "bw" | "colourful"
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

function createBusiness({
  businessId,
  name,
  description = null,
  logoUrl = null,
  address = null,
  contactPhone = null,
  businessEmail = null,
  websiteUrl = null,
  owner = null,
  brandColors = null,
  preferredStyle = "realistic",
}) {
  const now = admin.firestore.FieldValue.serverTimestamp();

  return {
    ...BusinessFields,
    businessId,
    name,
    description,
    logoUrl,
    address,
    contactPhone,
    businessEmail,
    websiteUrl,
    owner,
    brandColors,
    preferredStyle,
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = { BusinessFields, createBusiness };
