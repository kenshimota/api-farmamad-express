process.env.JWT_SECRET = "test-secret";

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const productsRouter = require("./index");

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const validBody = {
  name: "Ibuprofeno 400 mg",
  description: "Analgésico y antiinflamatorio",
  reference: "IBU-400",
  category_id: 1,
  image_id: 2,
  tax_id: 3,
};

const app = express();
app.use(express.json());
app.use("/products", productsRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

/**
 * Signs a JWT for the given role.
 * @param {string} [role] - Role name to embed in the token.
 * @returns {string} Signed JWT.
 */
function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "admin", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Builds a stored product double as returned by Sequelize.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The product double.
 */
function storedProduct(overrides = {}) {
  return {
    id: 1,
    ...validBody,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

/**
 * Sends a POST /products request.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body, token = tokenFor()) {
  const req = request(app).post("/products");

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

module.exports = {
  AUTH_USER,
  app,
  post,
  storedProduct,
  tokenFor,
  validBody,
};
