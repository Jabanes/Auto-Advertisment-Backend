require("dotenv").config({ quiet: true });

const {
  PORT = 3000,
  FRONTEND_URLS = "http://localhost:8081",
  JWT_SECRET = "super_secret_key",
  ACCESS_TOKEN_EXPIRES_IN = "1h",
  REFRESH_TOKEN_EXPIRES_IN = "7d",
  FIREBASE_API_KEY,
  GOOGLE_APPLICATION_CREDENTIALS,
  FIREBASE_STORAGE_BUCKET,
  OPENAI_API_KEY,
  OPENAI_ORG_ID,
  GOOGLE_WEB_CLIENT_ID,
  NODE_ENV = "development",
  LOG_LEVEL = "debug",
} = process.env;

if (!FIREBASE_API_KEY) {
  console.warn("⚠️  FIREBASE_API_KEY is missing. /auth/login (email+password) won't work.");
}

const allowedOrigins = FRONTEND_URLS.split(",").map((url) => url.trim());

module.exports = {
  PORT,
  FRONTEND_URLS: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  JWT_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  FIREBASE_API_KEY,
  GOOGLE_APPLICATION_CREDENTIALS,
  FIREBASE_STORAGE_BUCKET,
  OPENAI_API_KEY,
  OPENAI_ORG_ID,
  GOOGLE_WEB_CLIENT_ID,
  NODE_ENV,
  LOG_LEVEL,
  isDev: NODE_ENV !== "production",
};
