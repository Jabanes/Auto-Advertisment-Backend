const jwt = require("jsonwebtoken");

const {
  JWT_SECRET = "super_secret_key",
  ACCESS_TOKEN_EXPIRES_IN = "1h",
  REFRESH_TOKEN_EXPIRES_IN = "7d",
} = process.env;

function generateAccessToken(uid) {
  return jwt.sign({ uid }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

function generateRefreshToken(uid) {
  return jwt.sign({ uid, type: "refresh" }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
};
