process.env.JWT_SECRET = "test-secret";

jest.mock("../models/product", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/category", () => ({ findByPk: jest.fn() }));
jest.mock("../models/image", () => ({ findByPk: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const Product = require("../models/product");
const Category = require("../models/category");
const Image = require("../models/image");
const User = require("../models/user");
const updateRouter = require("./update");

const app = express();
app.use(express.json());
app.use("/products", updateRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const validBody = {
  name: "Ibuprofeno 800 mg",
  description: "Analgésico y antiinflamatorio",
  reference: "IBU-800",
  category_id: 1,
  image_id: 2,
};

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
 * Builds a stored product double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The product double.
 */
function target(overrides = {}) {
  return {
    id: 1,
    name: "Ibuprofeno 400 mg",
    description: "Analgésico y antiinflamatorio",
    reference: "IBU-400",
    category_id: 1,
    image_id: 2,
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

/**
 * Sends a PUT /products/:id request.
 * @param {string} id - Route parameter.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function put(id, body, token = tokenFor()) {
  const req = request(app).put(`/products/${id}`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  Product.findByPk.mockReset();
  Category.findByPk.mockReset();
  Image.findByPk.mockReset();
  User.findByPk.mockReset();
  Category.findByPk.mockResolvedValue({ id: 1 });
  Image.findByPk.mockResolvedValue({ id: 2 });
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("PUT /products/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update the product and answers 202",
    async (role) => {
      const product = target();
      Product.findByPk.mockResolvedValue(product);

      const response = await put("1", validBody, tokenFor(role));

      expect(response.status).toBe(202);
      expect(response.body).toEqual({ id: 1, ...validBody });
      expect(product.update).toHaveBeenCalledWith(validBody);
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("trims the text fields before persisting them", async () => {
    const product = target();
    Product.findByPk.mockResolvedValue(product);

    const response = await put("1", {
      ...validBody,
      name: "  Ibuprofeno 800 mg  ",
      reference: "  IBU-800  ",
    });

    expect(response.status).toBe(202);
    expect(product.update).toHaveBeenCalledWith(validBody);
  });

  it("drops unknown and audit fields", async () => {
    const product = target();
    Product.findByPk.mockResolvedValue(product);

    const response = await put("1", {
      ...validBody,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(202);
    expect(product.update).toHaveBeenCalledWith(validBody);
  });

  it("responds 409 when the reference belongs to another product", async () => {
    const product = target();
    product.update.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );
    Product.findByPk.mockResolvedValue(product);

    const response = await put("1", validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Product already exists" });
  });

  it("responds 422 when the category does not exist", async () => {
    Product.findByPk.mockResolvedValue(target());
    Category.findByPk.mockResolvedValue(null);

    const response = await put("1", validBody);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { category_id: "Invalid category id" },
    });
  });

  it("responds 422 when the image does not exist", async () => {
    Product.findByPk.mockResolvedValue(target());
    Image.findByPk.mockResolvedValue(null);

    const response = await put("1", validBody);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { image_id: "Invalid image id" },
    });
  });

  it("maps a race-condition foreign key error to 422", async () => {
    const product = target();
    product.update.mockRejectedValue(
      new ForeignKeyConstraintError({
        message: "foreign key",
        fields: ["image_id"],
      }),
    );
    Product.findByPk.mockResolvedValue(product);

    const response = await put("1", validBody);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { image_id: "Invalid image id" },
    });
  });

  it("responds 404 when the product does not exist", async () => {
    Product.findByPk.mockResolvedValue(null);

    const response = await put("999", validBody);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Product not found" });
    expect(Category.findByPk).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await put(id, validBody);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid product id" },
      });
      expect(Product.findByPk).not.toHaveBeenCalled();
    },
  );

  it.each([
    {},
    { ...validBody, name: undefined },
    { ...validBody, description: null },
    { ...validBody, reference: "" },
    { ...validBody, category_id: undefined },
    { ...validBody, image_id: null },
  ])("responds 400 when a required field is missing in %p", async (body) => {
    const response = await put("1", body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message:
        "name, description, reference, category_id and image_id are required",
    });
    expect(Product.findByPk).not.toHaveBeenCalled();
  });

  it("responds 422 when a field is invalid", async () => {
    const response = await put("1", {
      ...validBody,
      reference: "a".repeat(101),
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { reference: "Referencia inválida" },
    });
    expect(Product.findByPk).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is missing", async () => {
    const response = await put("1", validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await put("1", validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Product.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await put("1", validBody);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const product = target();
    product.update.mockRejectedValue(new Error("database exploded"));
    Product.findByPk.mockResolvedValue(product);

    const response = await put("1", validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
