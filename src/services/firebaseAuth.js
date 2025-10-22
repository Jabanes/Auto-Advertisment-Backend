const { FIREBASE_API_KEY } = require("../config/env");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

async function firebaseSignInWithPassword(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const errMsg = data?.error?.message || "INVALID_CREDENTIALS";
    const err = new Error(errMsg);
    err.code = "auth/invalid-credentials";
    throw err;
  }
  return data; // { idToken, refreshToken, expiresIn, localId, email }
}

module.exports = { firebaseSignInWithPassword };
