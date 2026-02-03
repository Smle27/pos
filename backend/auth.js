const crypto = require("crypto");

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const iterations = 120000;
  const keylen = 32;
  const digest = "sha256";
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString("hex");
  return { salt, hash, iterations, keylen, digest };
}

function verifyPassword(password, stored) {
  const hash = crypto
    .pbkdf2Sync(password, stored.salt, stored.iterations, stored.keylen, stored.digest)
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(stored.hash, "hex"));
}

function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

module.exports = { hashPassword, verifyPassword, newToken };
