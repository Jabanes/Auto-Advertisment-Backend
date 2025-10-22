/**
 * BusinessModel — defines the Firestore schema for business documents
 */

const admin = require("firebase-admin");

const BusinessFields = {
  businessId: null,
  name: null,
  description: null,
  logoUrl: null,
  address: { street: null, city: null, postalCode: null, country: null },
  contactPhone: null,
  businessEmail: null,
  websiteUrl: null,
  owner: { name: null, email: null, phone: null },
  brandColors: [],
  preferredStyle: "realistic",

  // 🆕 New AI context fields
  businessType: null,      // "product_seller" | "service_provider" | "content_creator"
  category: null,          // "fashion" | "food" | "technology" | "beauty" | ...
  targetAudience: null,    // e.g. "נשים צעירות שאוהבות אופנה ישראלית"
  toneOfVoice: null,       // "אישי וקליל" | "רשמי ומקצועי" | ...
  visualStyle: null,       // "minimalistic, bright, clean" ...
  businessPersona: {       // personalization tone
    type: null,            // "owner" | "brand"
    name: null,
    gender: null,          // "male" | "female" | "neutral"
  },
  sellingPlatforms: [],    // ["facebook_marketplace", "instagram", ...]
  location: null,          // "תל אביב, ישראל"
  languages: ["hebrew"],   // default
  businessGoal: null,      // "sale" | "brand_awareness" | ...
  slogan: null,
  instagram: null,
  facebook: null,
  tiktok: null,

  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

/**
 * 🧩 Create a new business object with defaults
 */
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
  brandColors = [],
  preferredStyle = "realistic",

  // 🧠 AI context fields
  businessType = null,
  category = null,
  targetAudience = null,
  toneOfVoice = null,
  visualStyle = null,
  businessPersona = { type: null, name: null, gender: null },
  sellingPlatforms = [],
  location = null,
  languages = ["hebrew"],
  businessGoal = null,
  slogan = null,
  instagram = null,
  facebook = null,
  tiktok = null,
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
    businessType,
    category,
    targetAudience,
    toneOfVoice,
    visualStyle,
    businessPersona,
    sellingPlatforms,
    location,
    languages,
    businessGoal,
    slogan,
    instagram,
    facebook,
    tiktok,
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = { BusinessFields, createBusiness };
