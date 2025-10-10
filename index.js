require("dotenv").config({ quiet: true }); // Load environment variables

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const OpenAI = require("openai");
const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);
// -------------------------------------
// Env + Config
// -------------------------------------
const {
    PORT = 3000,
    FRONTEND_URL = "http://localhost:8081",
    JWT_SECRET = "super_secret_key",
    ACCESS_TOKEN_EXPIRES_IN = "1h",
    REFRESH_TOKEN_EXPIRES_IN = "7d",
    FIREBASE_API_KEY, // REQUIRED for email/password login via REST
    GOOGLE_APPLICATION_CREDENTIALS,
    FIREBASE_STORAGE_BUCKET,
    OPENAI_API_KEY,
    OPENAI_ORG_ID,
    NODE_ENV = "development",
    LOG_LEVEL = "debug",
} = process.env;

if (!FIREBASE_API_KEY) {
    console.warn("⚠️  FIREBASE_API_KEY is missing. /auth/login (email+password) won't work.");
}

const isDev = NODE_ENV !== "production";
const log = (...args) => {
    if (isDev) console.log(...args);
};

// -------------------------------------
// OpenAI client (optional features)
// -------------------------------------
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    organization: OPENAI_ORG_ID,
});

// -------------------------------------
// Firebase Admin
// -------------------------------------
const serviceAccount = require(GOOGLE_APPLICATION_CREDENTIALS);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
const storage = admin.storage();

// -------------------------------------
// Express App
// -------------------------------------
const app = express();
app.use(
    cors({
        origin: FRONTEND_URL,
        credentials: true,
    })
);
app.use(bodyParser.json());

// -------------------------------------
// JWT helpers
// -------------------------------------
function generateAccessToken(uid) {
    return jwt.sign({ uid }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}
function generateRefreshToken(uid) {
    return jwt.sign({ uid, type: "refresh" }, JWT_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });
}

// Middleware to verify access token
function verifyAccessToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res
            .status(401)
            .json({ success: false, error: "Missing Authorization header", code: "auth/unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { uid }
        return next();
    } catch (err) {
        return res
            .status(401)
            .json({ success: false, error: "Invalid or expired token", code: "auth/invalid-token" });
    }
}

// -------------------------------------
// Firebase Auth REST helpers (login with email/password)
// -------------------------------------
async function firebaseSignInWithPassword(email, password) {
    // https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=[API_KEY]
    const fetch = (await import("node-fetch")).default;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

    const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email,
            password,
            returnSecureToken: true,
        }),
    });

    const data = await resp.json();
    if (!resp.ok) {
        const errMsg = data?.error?.message || "INVALID_CREDENTIALS";
        throw Object.assign(new Error(errMsg), { code: "auth/invalid-credentials" });
    }

    // data: { idToken, refreshToken, expiresIn, localId, email }
    return data;
}

// -------------------------------------
// Auth: REGISTER (email/password)
// -------------------------------------
app.post("/auth/register", async (req, res) => {
    try {
        const { email, password, displayName } = req.body || {};
        if (!email || !password) {
            return res
                .status(400)
                .json({ success: false, error: "Missing email or password", code: "auth/invalid-input" });
        }

        log("📝 Registering user:", email);

        // Create Firebase Auth user
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName,
        });

        // Create Firestore user doc
        const now = admin.firestore.FieldValue.serverTimestamp();
        await db.collection("users").doc(userRecord.uid).set({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: displayName || null,
            photoURL: userRecord.photoURL || null,
            emailVerified: false,
            provider: "email",
            createdAt: now,
            lastLoginAt: now,
        });

        // Issue our own tokens
        const accessToken = generateAccessToken(userRecord.uid);
        const refreshToken = generateRefreshToken(userRecord.uid);

        res.status(201).json({
            success: true,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: displayName || null,
                photoURL: userRecord.photoURL || null,
                emailVerified: false,
                provider: "email",
            },
            accessToken,
            refreshToken,
        });
    } catch (error) {
        log("❌ Registration error:", error?.message || error);
        let message = "Registration failed.";
        let code = "auth/registration-failed";

        if (error?.code === "auth/email-already-exists") {
            message = "The email address is already in use by another account.";
            code = "auth/email-already-exists";
            return res.status(400).json({ success: false, error: message, code });
        }

        return res.status(400).json({ success: false, error: message, code });
    }
});

// -------------------------------------
// Auth: LOGIN (email/password)
// -------------------------------------
app.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res
                .status(400)
                .json({ success: false, error: "Missing email or password", code: "auth/invalid-input" });
        }

        log("🔐 Email/Password login attempt:", email);

        // Use Firebase Identity Toolkit REST API to verify password
        const authData = await firebaseSignInWithPassword(email, password);
        // Verify the returned Firebase ID token to extract UID
        const decoded = await admin.auth().verifyIdToken(authData.idToken);
        const uid = decoded.uid;

        // Update last login in Firestore
        await db.collection("users").doc(uid).set(
            {
                lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        // Build user object from Firebase Auth
        const userRecord = await admin.auth().getUser(uid);

        const user = {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName || null,
            photoURL: userRecord.photoURL || null,
            emailVerified: userRecord.emailVerified || false,
            provider: "email",
        };

        // Issue our own tokens
        const accessToken = generateAccessToken(uid);
        const refreshToken = generateRefreshToken(uid);

        res.json({
            success: true,
            user,
            accessToken,
            refreshToken,
        });
    } catch (error) {
        log("❌ Login error:", error?.message || error);
        return res.status(401).json({
            success: false,
            error: "Invalid credentials",
            code: "auth/invalid-credentials",
            message: "The email or password is incorrect.",
        });
    }
});

/**
 * Auth: Google Sign-In
 */
app.post("/auth/google", async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            console.warn("⚠️ Missing idToken in request body");
            return res.status(400).json({
                success: false,
                error: "Missing idToken",
                code: "auth/missing-id-token",
            });
        }

        let decoded;

        try {
            // Try verifying as Firebase token first (in case it comes from Firebase Auth)
            decoded = await admin.auth().verifyIdToken(idToken);
            console.log("✅ Firebase ID token verified.");
        } catch (firebaseErr) {
            // If it's not a Firebase token, fall back to Google verification
            console.log("ℹ️ Falling back to Google OAuth verification...");
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_WEB_CLIENT_ID,
            });
            decoded = ticket.getPayload();
        }

        const { sub, email, name, picture } = decoded;
        const uid = decoded.uid || sub; // Google tokens use 'sub' as unique ID
        const displayName = name || "Google User";
        const photoURL = picture || null;
        const emailVerified = decoded.email_verified ?? true;

        console.log("✅ Google token verified for:", email);

        // Ensure user exists in Firestore
        const userRef = db.collection("users").doc(uid);
        const userDoc = await userRef.get();
        const now = admin.firestore.FieldValue.serverTimestamp();

        if (!userDoc.exists) {
            console.log("🆕 Creating Firestore user for:", email);
            await userRef.set({
                uid,
                email,
                displayName,
                photoURL,
                provider: "google.com",
                emailVerified,
                createdAt: now,
                lastLoginAt: now,
            });
        } else {
            console.log("🔁 Updating last login for:", email);
            await userRef.update({ lastLoginAt: now });
        }

        // Issue your app’s own tokens
        const accessToken = generateAccessToken(uid);
        const refreshToken = generateRefreshToken(uid);

        const user = { uid, email, displayName, photoURL, emailVerified, provider: "google.com" };

        res.status(200).json({
            success: true,
            message: "Google Sign-In successful",
            user,
            accessToken,
            refreshToken,
        });

        console.log("🚀 Google Sign-In flow completed for:", email);
    } catch (err) {
        console.error("❌ Google Sign-In failed:", err);
        res.status(401).json({
            success: false,
            error: "Invalid or expired Google token",
            message: err.message,
            code: "auth/invalid-id-token",
        });
    }
});

// -------------------------------------
// Auth: REFRESH TOKEN
// -------------------------------------
app.post("/auth/refresh", async (req, res) => {
    try {
        const { refreshToken } = req.body || {};
        if (!refreshToken) {
            return res
                .status(400)
                .json({ success: false, error: "Missing refreshToken", code: "auth/missing-refresh-token" });
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, JWT_SECRET);
        } catch (e) {
            return res.status(401).json({
                success: false,
                error: "Invalid refresh token",
                code: "auth/invalid-refresh-token",
            });
        }

        if (decoded?.type !== "refresh" || !decoded?.uid) {
            return res.status(401).json({
                success: false,
                error: "Invalid refresh token type",
                code: "auth/invalid-refresh-token",
            });
        }

        const uid = decoded.uid;

        // (Optional) You can check against a DB-stored refresh token whitelist here

        // Rotate tokens
        const newAccessToken = generateAccessToken(uid);
        const newRefreshToken = generateRefreshToken(uid);

        // Return minimal user info or fetch from Firestore if you need to
        const userRecord = await admin.auth().getUser(uid);
        const user = {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName || null,
            photoURL: userRecord.photoURL || null,
            emailVerified: userRecord.emailVerified || false,
        };

        res.json({
            success: true,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            user,
        });
    } catch (error) {
        console.error("❌ Refresh token error:", error);
        res.status(401).json({
            success: false,
            error: "Invalid refresh token",
            code: "auth/invalid-refresh-token",
        });
    }
});

// -------------------------------------
// Auth: LOGOUT
// -------------------------------------
app.post("/auth/logout", verifyAccessToken, async (req, res) => {
    try {
        // Optional: revoke Firebase refresh tokens
        // await admin.auth().revokeRefreshTokens(req.user.uid);

        // If you store refresh tokens server-side, invalidate them here.

        res.json({ success: true, message: "Logout successful" });
    } catch (error) {
        console.error("❌ Logout error:", error);
        res.status(500).json({
            success: false,
            error: "Logout failed",
            code: "auth/logout-failed",
        });
    }
});

// -------------------------------------
// Auth: VERIFY ACCESS TOKEN (optional)
// -------------------------------------
app.get("/auth/verify", verifyAccessToken, async (req, res) => {
    res.json({
        success: true,
        user: { uid: req.user.uid },
    });
});

// -------------------------------------
// Protected: Upload products
// -------------------------------------
app.post("/upload-products", verifyAccessToken, async (req, res) => {
    try {
        let { businessId, businessInfo, products } = req.body;

        if (!businessId || !products) {
            return res.status(400).json({
                success: false,
                error: "Request must include businessId and products",
            });
        }

        if (typeof businessInfo === "string") {
            try {
                businessInfo = JSON.parse(businessInfo);
            } catch {
                businessInfo = {};
            }
        }

        if (!Array.isArray(products)) {
            products = [products];
        }

        const businessRef = db.collection("businesses").doc(businessId);
        await businessRef.set(businessInfo || {}, { merge: true });

        const batch = db.batch();
        const now = admin.firestore.FieldValue.serverTimestamp();

        products.forEach((product) => {
            const productId =
                product.id || crypto.createHash("md5").update(product.Name).digest("hex");

            const productRef = businessRef.collection("products").doc(productId);

            batch.set(
                productRef,
                {
                    ...product,
                    createdAt: now,
                    updatedAt: now,
                    isPosted: false,
                    isEnriched: false,
                    postDate: null,
                },
                { merge: true }
            );
        });

        await batch.commit();

        res.json({
            success: true,
            message: `Saved ${products.length} products for business ${businessId}`,
            businessId,
            savedCount: products.length,
        });
    } catch (err) {
        console.error("❌ Error saving products:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

// -------------------------------------
// Protected: Get next product (unposted + not enriched)
// -------------------------------------
app.get("/next-product/:businessId", verifyAccessToken, async (req, res) => {
    try {
        const { businessId } = req.params;
        const snapshot = await db
            .collection("businesses")
            .doc(businessId)
            .collection("products")
            .where("isPosted", "==", false)
            .where("isEnriched", "==", false)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return res
                .status(404)
                .json({ success: false, error: "No unposted and unenriched products found" });
        }

        const doc = snapshot.docs[0];
        res.json({
            success: true,
            businessId,
            productId: doc.id,
            ...doc.data(),
        });
    } catch (err) {
        console.error("❌ Error fetching product:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

// -------------------------------------
// Protected: Update product with generated advertisement + prompt
// -------------------------------------
app.post("/update-product/:businessId/:productId", verifyAccessToken, async (req, res) => {
    try {
        const { businessId, productId } = req.params;
        const { advertisementText, imagePrompt } = req.body;

        const productRef = db
            .collection("businesses")
            .doc(businessId)
            .collection("products")
            .doc(productId);

        await productRef.set(
            {
                advertisementText: advertisementText || null,
                imagePrompt: imagePrompt || null,
                isEnriched: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        res.json({
            success: true,
            message: `Updated product ${productId} with advertisement fields`,
        });
    } catch (err) {
        console.error("❌ Error updating product:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

// -------------------------------------
// Protected: Generate ad image (OpenAI) and upload to Firebase Storage
// -------------------------------------
app.post("/generate-ad-image", verifyAccessToken, async (req, res) => {
    try {
        const { businessId, productId } = req.body;

        if (!businessId || !productId) {
            return res.status(400).json({ success: false, error: "Missing businessId or productId" });
        }

        const productRef = db
            .collection("businesses")
            .doc(businessId)
            .collection("products")
            .doc(productId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            return res.status(404).json({ success: false, error: "Product not found" });
        }

        const product = productDoc.data();
        const { ImageUrl, imagePrompt } = product;

        if (!ImageUrl || !imagePrompt) {
            return res
                .status(400)
                .json({ success: false, error: "Product missing ImageUrl or imagePrompt" });
        }

        // Download + convert image
        const fetch = (await import("node-fetch")).default;
        const sharp = (await import("sharp")).default;
        const fs = await import("fs");
        const path = await import("path");
        const os = await import("os");
        const FormData = (await import("form-data")).default;

        const imageResponse = await fetch(ImageUrl);
        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        const pngBuffer = await sharp(buffer).png().toBuffer();

        const tmpFile = path.join(os.tmpdir(), `${productId}.png`);
        fs.writeFileSync(tmpFile, pngBuffer);

        // Build FormData for OpenAI
        const form = new FormData();
        form.append("model", "gpt-image-1");
        form.append("prompt", imagePrompt);
        form.append("size", "1024x1024");
        form.append("image", fs.createReadStream(tmpFile), {
            filename: `${productId}.png`,
            contentType: "image/png",
        });

        const headers = {
            ...form.getHeaders(),
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "OpenAI-Organization": OPENAI_ORG_ID,
        };

        const openaiResp = await fetch("https://api.openai.com/v1/images/edits", {
            method: "POST",
            headers,
            body: form,
        });

        const data = await openaiResp.json();

        if (!data?.data?.[0]?.b64_json) {
            console.error("❌ OpenAI returned invalid response:", data);
            return res.status(500).json({ success: false, error: "OpenAI did not return valid image data" });
        }

        const generatedBuffer = Buffer.from(data.data[0].b64_json, "base64");

        // Upload to Firebase Storage
        const bucket = storage.bucket(FIREBASE_STORAGE_BUCKET);
        const filePath = `generated_ads/${businessId}/${productId}.png`;
        const file = bucket.file(filePath);

        await file.save(generatedBuffer, {
            metadata: { contentType: "image/png" },
            public: true, // consider signed URLs in prod
        });

        const publicUrl = `https://storage.googleapis.com/${FIREBASE_STORAGE_BUCKET}/${filePath}`;

        // Update Firestore
        await productRef.set(
            {
                generatedImageUrl: publicUrl,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        res.json({
            success: true,
            message: `Generated advertisement image for product ${productId}`,
            generatedImageUrl: publicUrl,
        });
    } catch (err) {
        console.error("❌ Error generating ad image:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

// -------------------------------------
// Bootstrap
// -------------------------------------
app.listen(PORT, () => {
    log("==================================================");
    log(`🚀 Server running on http://localhost:${PORT}`);
    log(`🌍 CORS origin: ${FRONTEND_URL}`);
    log(`🔐 JWT: access=${ACCESS_TOKEN_EXPIRES_IN} refresh=${REFRESH_TOKEN_EXPIRES_IN}`);
    log(`🔥 Firebase project: ${serviceAccount.project_id || "(from service account)"}`);
    log(`🗄️  Storage bucket: ${FIREBASE_STORAGE_BUCKET || "(not set)"}`);
    log("==================================================");
});
