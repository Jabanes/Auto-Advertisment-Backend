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
  PENDING: "pending", // newly created or waiting enrichment
  PROCESSING: "processing", // enrichment (AI) started
  ENRICHED: "enriched", // enrichment completed successfully
  POSTED: "posted", // manually published
  FAILED: "failed", // enrichment or generation failed
});

module.exports = { STATUS };
