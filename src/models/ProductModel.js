/**
 * ProductModel — defines the Firestore schema for product documents
 *
 * 🔄 Replaces isEnriched + isPosted with a unified "status" enum:
 *    - "pending"   → newly created, waiting for enrichment
 *    - "processing"→ enrichment in progress (AI generating)
 *    - "enriched"  → AI-generated fields (image + ad text) are ready
 *    - "posted"    → advertisement published
 *    - "failed"    → enrichment failed
 *
 * 🧠 Includes AI configuration fields for personalized generation.
 */

const admin = require("firebase-admin");
const { STATUS } = require("../constants/statusEnum");

const ProductFields = {
  id: null,
  name: null,
  price: null,
  description: null,
  imageUrl: null,
  generatedImageUrl: null,
  advertisementText: null,
  imagePrompt: null,

  // 🔄 unified lifecycle
  status: STATUS.PENDING,

  // 🔗 relationships
  businessId: null,

  // 🧠 AI configuration and generation metadata
  productType: null,                // "physical" | "digital" | "service"
  productCategory: null,            // "fashion" | "food" | "education" | ...
  marketingGoal: null,              // "sale" | "brand_awareness" | ...
  visualMood: null,                 // "bright" | "luxury" | "minimal"
  photoStyle: null,                 // "realistic" | "studio" | "creative"
  backgroundStyle: null,            // "plain_white" | "environmental" | "on_model"
  targetAudience: null,             // textual context (e.g., "אנשי הייטק צעירים")
  includePriceInAd: true,           // whether to mention price in ad text
  emphasizeBrandIdentity: false,    // whether to inject brand tone
  preserveOriginalProduct: true,    // whether to keep product’s real look in generated image
  aspectRatio: "1:1",               // AI image ratio (e.g., 1:1, 16:9)
  toneOfVoice: null,                // override if needed
  secondaryLanguage: null,          // optional ad translation target

  // 🕓 timestamps
  postDate: null,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

/**
 * 🧩 Create a new product document with sane defaults
 */
function createProduct(product = {}) {
  const now = admin.firestore.FieldValue.serverTimestamp();

  return {
    ...ProductFields,
    ...product,

    id: product.id || product.productId || null,
    businessId: product.businessId || null,
    name: product.name || null,
    price: product.price || null,
    description: product.description || null,
    imageUrl: product.imageUrl || null,
    generatedImageUrl: product.generatedImageUrl || null,
    advertisementText: product.advertisementText || null,
    imagePrompt: product.imagePrompt || null,

    // Lifecycle + timestamps
    status: product.status || STATUS.PENDING,
    postDate: product.postDate || null,
    createdAt: now,
    updatedAt: now,

    // AI configuration
    productType: product.productType || null,
    productCategory: product.productCategory || null,
    marketingGoal: product.marketingGoal || null,
    visualMood: product.visualMood || null,
    photoStyle: product.photoStyle || null,
    backgroundStyle: product.backgroundStyle || null,
    targetAudience: product.targetAudience || null,
    includePriceInAd:
      typeof product.includePriceInAd === "boolean"
        ? product.includePriceInAd
        : true,
    emphasizeBrandIdentity:
      typeof product.emphasizeBrandIdentity === "boolean"
        ? product.emphasizeBrandIdentity
        : false,
    preserveOriginalProduct:
      typeof product.preserveOriginalProduct === "boolean"
        ? product.preserveOriginalProduct
        : true,
    aspectRatio: product.aspectRatio || "1:1",
    toneOfVoice: product.toneOfVoice || null,
    secondaryLanguage: product.secondaryLanguage || null,
  };
}

module.exports = { ProductFields, createProduct };
