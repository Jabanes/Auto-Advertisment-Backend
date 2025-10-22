/**
 * ProductModel — defines the Firestore schema for product documents
 * 
 * 🔄 Replaces isEnriched + isPosted with a unified "status" enum:
 *    - "pending"   → newly created, waiting for enrichment
 *    - "enriched"  → AI-generated fields (image + ad text) are ready
 *    - "posted"    → advertisement published
 * 
 * TODO: Update all references in routes, n8n workflows, and AI pipeline 
 *       that currently check "isEnriched" or "isPosted" to use "status".
 */

const admin = require("firebase-admin");
const { STATUS } = require("../constants/statusEnum");

const ProductFields = {
  id: null,
  name: null,
  price: null,
  imageUrl: null,
  advertisementText: null,
  imagePrompt: null,
  generatedImageUrl: null,

  // 🔄 unified status field replaces isEnriched + isPosted
  status: STATUS.PENDING,

  postDate: null,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

function createProduct(product) {
  const now = admin.firestore.FieldValue.serverTimestamp();

  return {
    ...ProductFields,
    ...product,
    id: product.id || product.productId || null,
    status: product.status || "pending", // default lifecycle start
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = { ProductFields, createProduct };
