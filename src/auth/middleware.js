const jwt = require("jsonwebtoken");

/**
 * Reads the mandatory JWT secret from the environment.
 * @returns {string} The JWT signing secret.
 * @throws {Error} When JWT_SECRET is not defined.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }

  return secret;
}

/**
 * Express middleware that verifies the Bearer JWT and attaches its payload to
 * `req.user`.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Express next function.
 * @returns {void}
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    req.user = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

module.exports = { authenticate, getJwtSecret };
