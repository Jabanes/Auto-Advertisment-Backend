const { isDev } = require("../config/env");

function log(...args) {
  if (isDev) console.log(...args);
}

function error(...args) {
  console.error("❌", ...args);
}

module.exports = { log, error };
