const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("./middleware");
const { getRoleName } = require("./serializers");

const JWT_ALGORITHM = "HS256";
const DEFAULT_EXPIRES_IN = "1h";

/**
 * Signs a JWT for the given user, including the role name.
 * @param {object} user - Authenticated user.
 * @returns {string} The signed JWT.
 */
function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: getRoleName(user),
    },
    getJwtSecret(),
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
    },
  );
}

module.exports = { signToken, JWT_ALGORITHM, DEFAULT_EXPIRES_IN };
