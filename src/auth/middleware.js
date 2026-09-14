const jwt = require("jsonwebtoken");
const User = require("../models/user");

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
 * Express middleware that verifies the Bearer JWT, checks that the user still
 * exists and is not blocked, and attaches the token payload to `req.user`.
 * A missing user invalidates the session with 401, while a blocked user gets
 * 403 so the client can tell the account is suspended.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Express next function.
 * @returns {Promise<void>} Resolves once the request continues or responds.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (payload.sub === undefined || payload.sub === null) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const user = await User.findByPk(payload.sub);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "User is blocked" });
    }

    req.user = payload;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { authenticate, getJwtSecret };
