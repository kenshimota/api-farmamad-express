const { Router } = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const User = require("../models/user");
const { verifyPassword } = require("./password");
const { loginSchema, formatLoginErrors } = require("./validators");
const { authenticate, getJwtSecret } = require("./middleware");

const router = Router();

const JWT_ALGORITHM = "HS256";
const DEFAULT_EXPIRES_IN = "1h";

/**
 * Builds the public representation of a user, excluding the password hash.
 * @param {object} user - User instance or plain object.
 * @returns {{ id: number, username: string, email: string, name: string|null }}
 *   The public user data.
 */
function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
  };
}

/**
 * Signs a JWT for the given user.
 * @param {object} user - Authenticated user.
 * @returns {string} The signed JWT.
 */
function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, email: user.email },
    getJwtSecret(),
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
    },
  );
}

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Authenticates a user with email or username and password
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: User email or username
 *                 example: juan@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: secreto123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing identifier or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: identifier and password are required
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Invalid credentials
 *       422:
 *         description: Invalid fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 */
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body ?? {};

  if (!identifier || !password) {
    return res
      .status(400)
      .json({ message: "identifier and password are required" });
  }

  let credentials;
  try {
    credentials = await loginSchema.validate(
      { identifier, password },
      { abortEarly: false, stripUnknown: true },
    );
  } catch (error) {
    return res
      .status(422)
      .json({ errors: formatLoginErrors(error, identifier) });
  }

  const user = await User.findOne({
    where: {
      [Op.or]: [
        { email: credentials.identifier },
        { username: credentials.identifier },
      ],
    },
  });

  if (!user || !(await verifyPassword(credentials.password, user.password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  return res.json({ token: signToken(user), user: toPublicUser(user) });
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Returns the authenticated user information
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 */
router.get("/me", authenticate, async (req, res) => {
  const user = await User.findByPk(req.user.sub);

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return res.json(toPublicUser(user));
});

module.exports = router;
