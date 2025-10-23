/**
 * 🔔 Centralized Socket Emitter Utilities
 * 
 * Ensures consistent socket event emissions across all routes
 * with proper logging and error handling.
 */

/**
 * Emit product:updated event to user's room
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @param {string} userId - User UID (Firebase)
 * @param {object} product - Product data to emit (must include id and businessId)
 */
const emitProductUpdate = (io, userId, product) => {
  if (!io) {
    console.warn("⚠️ [Socket] Cannot emit product:updated - io instance not available");
    return;
  }
  
  if (!userId) {
    console.warn("⚠️ [Socket] Cannot emit product:updated - userId is missing");
    return;
  }

  if (!product?.id) {
    console.warn("⚠️ [Socket] Cannot emit product:updated - product.id is missing");
    return;
  }

  const room = `user:${userId}`;
  
  console.log(
    `📡 [Socket] Emitting 'product:updated' to room '${room}' | ` +
    `Product=${product.id} | Status=${product.status || 'unknown'} | ` +
    `Business=${product.businessId || 'unknown'}`
  );

  try {
    io.to(room).emit("product:updated", product);
    console.log(`  └─ ✅ Emission successful for product ${product.id}`);
  } catch (err) {
    console.error(`  └─ ❌ Emission failed:`, err.message);
  }
};

/**
 * Emit product:created event to user's room
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @param {string} userId - User UID (Firebase)
 * @param {object} product - Product data to emit (must include id and businessId)
 */
const emitProductCreate = (io, userId, product) => {
  if (!io) {
    console.warn("⚠️ [Socket] Cannot emit product:created - io instance not available");
    return;
  }
  
  if (!userId) {
    console.warn("⚠️ [Socket] Cannot emit product:created - userId is missing");
    return;
  }

  if (!product?.id) {
    console.warn("⚠️ [Socket] Cannot emit product:created - product.id is missing");
    return;
  }

  const room = `user:${userId}`;
  
  console.log(
    `📡 [Socket] Emitting 'product:created' to room '${room}' | ` +
    `Product=${product.id} | Name="${product.name || 'unnamed'}" | ` +
    `Business=${product.businessId || 'unknown'}`
  );

  try {
    io.to(room).emit("product:created", product);
    console.log(`  └─ ✅ Emission successful for product ${product.id}`);
  } catch (err) {
    console.error(`  └─ ❌ Emission failed:`, err.message);
  }
};

/**
 * Emit product:deleted event to user's room
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @param {string} userId - User UID (Firebase)
 * @param {string} productId - Product ID
 * @param {string} businessId - Business ID
 */
const emitProductDelete = (io, userId, productId, businessId) => {
  if (!io) {
    console.warn("⚠️ [Socket] Cannot emit product:deleted - io instance not available");
    return;
  }
  
  if (!userId) {
    console.warn("⚠️ [Socket] Cannot emit product:deleted - userId is missing");
    return;
  }

  if (!productId) {
    console.warn("⚠️ [Socket] Cannot emit product:deleted - productId is missing");
    return;
  }

  const room = `user:${userId}`;
  
  console.log(
    `📡 [Socket] Emitting 'product:deleted' to room '${room}' | ` +
    `Product=${productId} | Business=${businessId || 'unknown'}`
  );

  try {
    io.to(room).emit("product:deleted", { id: productId, businessId });
    console.log(`  └─ ✅ Emission successful for product ${productId}`);
  } catch (err) {
    console.error(`  └─ ❌ Emission failed:`, err.message);
  }
};

/**
 * Emit business:updated event to user's room
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @param {string} userId - User UID (Firebase)
 * @param {object} business - Business data to emit (must include businessId)
 */
const emitBusinessUpdate = (io, userId, business) => {
  if (!io) {
    console.warn("⚠️ [Socket] Cannot emit business:updated - io instance not available");
    return;
  }
  
  if (!userId) {
    console.warn("⚠️ [Socket] Cannot emit business:updated - userId is missing");
    return;
  }

  if (!business?.businessId) {
    console.warn("⚠️ [Socket] Cannot emit business:updated - business.businessId is missing");
    return;
  }

  const room = `user:${userId}`;
  
  console.log(
    `📡 [Socket] Emitting 'business:updated' to room '${room}' | ` +
    `Business=${business.businessId} | Name="${business.name || 'unnamed'}"`
  );

  try {
    io.to(room).emit("business:updated", business);
    console.log(`  └─ ✅ Emission successful for business ${business.businessId}`);
  } catch (err) {
    console.error(`  └─ ❌ Emission failed:`, err.message);
  }
};

module.exports = {
  emitProductUpdate,
  emitProductCreate,
  emitProductDelete,
  emitBusinessUpdate,
};

