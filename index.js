/**
 * Auto-Advertisement Backend
 * Modularized refactor — full parity with original backend functionality
 */

require("dotenv").config({ quiet: true });

const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");

const { PORT, FRONTEND_URLS, ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN, FIREBASE_STORAGE_BUCKET } = require("./src/config/env");
const { admin, serviceAccount } = require("./src/config/firebase");
const { log } = require("./src/utils/logger");

// Routes
const authRoutes = require("./src/routes/authRoutes");
const businessRoutes = require("./src/routes/businessRoutes");
const productRoutes = require("./src/routes/productRoutes");
const aiRoutes = require("./src/routes/aiRoutes");

// Initialize express
const app = express();
const server = http.createServer(app);

// -------------------------------------
// Socket.IO Setup
// -------------------------------------
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URLS,
    credentials: true,
  },
});

// Authenticate socket connection with Firebase token
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
    if (!token) {
      console.warn("⚠️ Socket connection attempt without token");
      return next(new Error("Authentication required"));
    }

    const decoded = await admin.auth().verifyIdToken(token);
    console.log(`[Socket Auth] ✅ Authenticated socket ${socket.id} for user ${decoded.uid}`);
    socket.user = { uid: decoded.uid, email: decoded.email }; // Attach user to the socket
    next();
  } catch (e) {
    console.error(`❌ Socket authentication failed for socket ${socket.id}:`, e.message);
    next(new Error("Unauthorized socket connection"));
  }
});

io.on("connection", (socket) => {
  const uid = socket.user?.uid;
  
  if (uid) {
    // Join user-specific room for targeted events
    socket.join(`user:${uid}`);
    log(`🔌 Socket connected: ${socket.id} → joined room user:${uid}`);
  } else {
    log(`🔌 Socket connected: ${socket.id} (unauthenticated)`);
  }

  socket.on("disconnect", () => {
    log(`🔌 Socket disconnected: ${socket.id}${uid ? ` from room user:${uid}` : ''}`);
  });
});

// -------------------------------------
// Middleware
// -------------------------------------
app.use(
  cors({
    origin: FRONTEND_URLS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);


app.use(bodyParser.json());

// Make io available in routes via req.app.get('io')
app.set("io", io);

// -------------------------------------
// Routes
// -------------------------------------
app.use("/auth", authRoutes);       // register, login, google, refresh, logout, verify
app.use("/businesses", businessRoutes); // CRUD and listing for businesses
app.use("/products", productRoutes);    // upload/update/list products
app.use("/ai", aiRoutes);              // OpenAI ad image generation

// -------------------------------------
// Root route
// -------------------------------------
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Auto-Advertisement Backend is running",
    status: "ok",
  });
});

// -------------------------------------
// Global Error Handler
// -------------------------------------
app.use((err, req, res, next) => {
  console.error("❌ Uncaught error:", err);
  res.status(500).json({ success: false, error: "Internal server error", details: err.message });
});

// -------------------------------------
// Bootstrap
// -------------------------------------
server.listen(PORT, () => {
  log("==================================================");
  log(`🚀 Server running on http://localhost:${PORT}`);
  log(`🌍 CORS origins: ${Array.isArray(FRONTEND_URLS) ? FRONTEND_URLS.join(", ") : FRONTEND_URLS}`);
  log(`🔐 JWT: access=${ACCESS_TOKEN_EXPIRES_IN} refresh=${REFRESH_TOKEN_EXPIRES_IN}`);
  log(`🔥 Firebase project: ${serviceAccount.project_id || "(from service account)"}`);
  log(`🗄️  Storage bucket: ${FIREBASE_STORAGE_BUCKET || "(not set)"}`);
  log("⚡ Socket.IO initialized and listening.");
  log("==================================================");
});
