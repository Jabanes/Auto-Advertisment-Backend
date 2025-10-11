/**
 * ProductModel — defines the Firestore schema for product documents
 */

const admin = require("firebase-admin");

const ProductFields = {
  id: null,
  name: null,
  price: null,
  imageUrl: null,
  advertisementText: null,
  imagePrompt: null,
  generatedImageUrl: null,
  isPosted: false,
  isEnriched: false,
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
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = { ProductFields, createProduct };
