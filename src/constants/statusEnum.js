/**
 * StatusEnum — shared constants for product lifecycle states.
 *
 * Ensures consistent usage across:
 * - Models (ProductModel)
 * - Routes (upload, AI generation, posting)
 * - n8n workflows / automation logic
 *
 * Usage Example:
 *   const { STATUS } = require("../constants/statusEnum");
 *   product.status = STATUS.PENDING;
 */

const STATUS = Object.freeze({
  PENDING: "pending",   // Waiting for enrichment (default after creation)
  ENRICHED: "enriched", // AI-generated image + text ready to post
  POSTED: "posted",     // Successfully posted/published
});

module.exports = { STATUS };
