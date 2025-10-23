/**
 * BusinessModel — defines the Firestore schema for business documents
 */

const admin = require("firebase-admin");

const now = admin.firestore.FieldValue.serverTimestamp();

const BusinessFields = {
  businessId: null,
  name: null,
  slogan: null,
  description: null,
  logoUrl: null,

  // 🏠 Address & Contact
  address: { street: null, city: null, postalCode: null, country: null },
  contactPhone: null,
  businessEmail: null,
  websiteUrl: null,

  // 👤 Owner info (synced from user but editable)
  owner: { name: null, email: null, phone: null },

  // 🎨 Branding
  brandColors: [],
  preferredStyle: "realistic",
  visualStyle: null,

  // 🧠 AI context fields
  businessType: null,
  category: null,
  businessGoal: null,
  toneOfVoice: null,
  businessPersona: { type: null, name: null, gender: null },
  targetAudience: null,
  sellingPlatforms: [],
  location: null,
  languages: ["hebrew"],

  // 🌐 Socials
  instagram: null,
  facebook: null,
  tiktok: null,

  createdAt: now,
  updatedAt: now,
};

/**
 * 🧩 Create a new business document with default values
 */
function createBusiness(data) {
  const {
    businessId,
    name,
    slogan = null,
    description = null,
    logoUrl = null,
    address = {},
    contactPhone = null,
    businessEmail = null,
    websiteUrl = null,
    owner = {},
    brandColors = [],
    preferredStyle = "realistic",
    visualStyle = null,

    // AI context
    businessType = null,
    category = null,
    businessGoal = null,
    toneOfVoice = null,
    businessPersona = { type: null, name: null, gender: null },
    targetAudience = null,
    sellingPlatforms = [],
    location = null,
    languages = ["hebrew"],

    // Social
    instagram = null,
    facebook = null,
    tiktok = null,
  } = data;

  return {
    ...BusinessFields,
    businessId,
    name,
    slogan,
    description,
    logoUrl,
    address: {
      street: address?.street || null,
      city: address?.city || null,
      postalCode: address?.postalCode || null,
      country: address?.country || null,
    },
    contactPhone,
    businessEmail,
    websiteUrl,
    owner: {
      name: owner?.name || null,
      email: owner?.email || null,
      phone: owner?.phone || null,
    },
    brandColors: Array.isArray(brandColors) ? brandColors : [],
    preferredStyle,
    visualStyle,
    businessType,
    category,
    businessGoal,
    toneOfVoice,
    businessPersona,
    targetAudience,
    sellingPlatforms,
    location,
    languages,
    instagram,
    facebook,
    tiktok,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

/**
 * 🔄 Update business document with only provided fields
 */
function updateBusiness(existingDoc, updates) {
  const merged = {
    ...existingDoc,
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  return merged;
}

module.exports = { BusinessFields, createBusiness, updateBusiness };
