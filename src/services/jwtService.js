/**
 * ⚠️  DEPRECATED - DO NOT USE
 * 
 * This file is kept for reference only.
 * The app now uses Firebase ID tokens exclusively.
 * 
 * Custom JWT generation has been removed in favor of:
 * - Client: firebase.auth().currentUser.getIdToken()
 * - Server: admin.auth().verifyIdToken()
 * 
 * If you see imports of this file anywhere, they should be removed.
 * 
 * Migration date: 2025-10-11
 */

module.exports = {
  // Deprecated functions - do not use
  generateAccessToken: () => {
    throw new Error("DEPRECATED: Use Firebase ID tokens instead");
  },
  generateRefreshToken: () => {
    throw new Error("DEPRECATED: Use Firebase ID tokens instead");
  },
  verifyToken: () => {
    throw new Error("DEPRECATED: Use admin.auth().verifyIdToken() instead");
  },
};
