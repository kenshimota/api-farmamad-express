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
const Product = require("../models/product");
const User = require("../models/user");
const listRouter = require("./list");

const app = express();
app.use(express.json());
app.use("/products", listRouter);

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const ALL_ROLES = [
  "admin",
  "seller",
  "dispatcher",
  "manager_warehouse",
  "support",
  "customer",
];
const storedProducts = [
  {
    id: 1,
    name: "Ibuprofeno 400 mg",
    description: "Analgésico y antiinflamatorio",
    reference: "IBU-400",
    category_id: 1,
    image_id: 1,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  },
  {
    id: 2,
    name: "Paracetamol 500 mg",
    description: "Analgésico y antipirético",
    reference: "PAR-500",
    category_id: 2,
    image_id: 2,
    createdAt: new Date("2026-09-02T00:00:00.000Z"),
    updatedAt: new Date("2026-09-02T00:00:00.000Z"),
  },
];

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
 * Sends a GET request with an optional bearer token.
 * @param {string} path - Request path under /products.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function get(path, token = tokenFor()) {
  const req = request(app).get(`/products${path}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  Product.create.mockReset();
  Product.findAll.mockReset();
  Product.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /products", () => {
  it.each(ALL_ROLES)(
    "returns the public products for an authenticated %s",
    async (role) => {
      Product.findAll.mockResolvedValue(storedProducts);

      const response = await get("/", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          name: "Ibuprofeno 400 mg",
          description: "Analgésico y antiinflamatorio",
          reference: "IBU-400",
          category_id: 1,
          image_id: 1,
        },
        {
          id: 2,
          name: "Paracetamol 500 mg",
          description: "Analgésico y antipirético",
          reference: "PAR-500",
          category_id: 2,
          image_id: 2,
        },
      ]);
      expect(response.body[0]).not.toHaveProperty("createdAt");
      expect(response.body[0]).not.toHaveProperty("updatedAt");
      expect(Product.findAll).toHaveBeenCalledWith({
        order: [["id", "ASC"]],
      });
    },
  );

  it("returns an empty array when there are no products", async () => {
    Product.findAll.mockResolvedValue([]);

    const response = await get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responds 401 without a token", async () => {
    const response = await get("/", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Product.findAll).not.toHaveBeenCalled();
  });

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get("/");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(Product.findAll).not.toHaveBeenCalled();
  });
});

describe("GET /products/:id", () => {
  it.each(ALL_ROLES)(
    "returns one public product for an authenticated %s",
    async (role) => {
      Product.findByPk.mockResolvedValue(storedProducts[0]);

      const response = await get("/1", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        name: "Ibuprofeno 400 mg",
        description: "Analgésico y antiinflamatorio",
        reference: "IBU-400",
        category_id: 1,
        image_id: 1,
      });
      expect(Product.findByPk).toHaveBeenCalledWith(1);
    },
  );

  it("responds 404 when the product does not exist", async () => {
    Product.findByPk.mockResolvedValue(null);

    const response = await get("/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Product not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await get(`/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid product id" },
      });
      expect(Product.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 without a token", async () => {
    const response = await get("/1", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
