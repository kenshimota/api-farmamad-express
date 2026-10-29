process.env.JWT_SECRET = "test-secret";

jest.mock("../database", () => ({
  transaction: jest.fn((callback) => callback({ id: "tx" })),
}));
jest.mock("../models/lot", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
  getAttributes: jest.fn(() => ({})),
}));
jest.mock("../models/product", () => ({ findByPk: jest.fn() }));
jest.mock("../models/item-state", () => ({ findByPk: jest.fn() }));
jest.mock("../models/warehouse", () => ({ findByPk: jest.fn() }));
jest.mock("../models/shelf", () => ({ findByPk: jest.fn() }));
jest.mock("../models/shelf-section", () => ({ findByPk: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const Lot = require("../models/lot");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const Warehouse = require("../models/warehouse");
const Shelf = require("../models/shelf");
const ShelfSection = require("../models/shelf-section");
const User = require("../models/user");
const lotsRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/lots", lotsRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const BODY = {
  number: "L-2026-001",
  product_id: 15,
  expiration_date: "2027-03-31",
  item_state_id: 1,
  stock: 120,
  reserved: 15,
  warehouse_id: 1,
  shelf_id: 1,
  section_id: 2,
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
 * Builds a stored lot double with its nested relations.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The lot double.
 */
function storedLot(overrides = {}) {
  return {
    id: 1,
    ...BODY,
    product: { id: 15, name: "Ibuprofeno 800 mg", reference: "IBU-800" },
    item_state: {
      id: 1,
      name: "sellable",
      label: "Vendible",
      is_sellable: true,
    },
    warehouse: { id: 1, name: "Bodega Central" },
    shelf: { id: 1, code: "A1", name: "Estante A1" },
    section: { id: 2, code: "A1-02", name: "Nivel 2" },
    update: jest.fn().mockImplementation(async function update(values) {
      Object.assign(this, values);
      return this;
    }),
    destroy: jest.fn().mockResolvedValue(),
    ...overrides,
  };
}

/**
 * Sends an authenticated request to the lots router.
 * @param {string} method - HTTP method in lowercase.
 * @param {string} path - Request path.
 * @param {object} [body] - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function call(method, path, body, token = tokenFor()) {
  const req = request(app)[method](path);

  if (body !== undefined) {
    req.send(body);
  }

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  User.findByPk.mockResolvedValue(AUTH_USER);
  Product.findByPk.mockResolvedValue({ id: 15 });
  ItemState.findByPk.mockResolvedValue({ id: 1 });
  Warehouse.findByPk.mockResolvedValue({ id: 1 });
  Shelf.findByPk.mockResolvedValue({ id: 1, warehouse_id: 1 });
  ShelfSection.findByPk.mockResolvedValue({ id: 2, shelf_id: 1 });
  Lot.findOne.mockResolvedValue(null);
  Lot.create.mockResolvedValue({ id: 1 });
  Lot.findByPk.mockResolvedValue(storedLot());
});

describe("POST /lots references and errors", () => {
  it.each([
    ["product", () => Product.findByPk.mockResolvedValue(null), "product_id"],
    [
      "item state",
      () => ItemState.findByPk.mockResolvedValue(null),
      "item_state_id",
    ],
    [
      "warehouse",
      () => Warehouse.findByPk.mockResolvedValue(null),
      "warehouse_id",
    ],
    ["shelf", () => Shelf.findByPk.mockResolvedValue(null), "shelf_id"],
    [
      "section",
      () => ShelfSection.findByPk.mockResolvedValue(null),
      "section_id",
    ],
  ])(
    "responds 422 when the %s does not exist",
    async (name, prepare, field) => {
      prepare();

      const response = await call("post", "/lots", BODY);

      expect(response.status).toBe(422);
      expect(response.body.errors).toHaveProperty(field);
      expect(Lot.create).not.toHaveBeenCalled();
    },
  );

  it("rejects a shelf from another warehouse with the documented message", async () => {
    Shelf.findByPk.mockResolvedValue({ id: 1, warehouse_id: 2 });

    const response = await call("post", "/lots", BODY);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { shelf_id: "Shelf does not belong to the warehouse" },
    });
  });

  it("rejects a section from another shelf with the documented message", async () => {
    ShelfSection.findByPk.mockResolvedValue({ id: 2, shelf_id: 2 });

    const response = await call("post", "/lots", BODY);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { section_id: "Section does not belong to the shelf" },
    });
  });

  it("responds 409 when the product already has that number", async () => {
    Lot.findOne.mockResolvedValue(storedLot({ id: 99 }));

    const response = await call("post", "/lots", BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Lot already exists" });
    expect(Lot.create).not.toHaveBeenCalled();
  });

  it("translates a unique constraint error to 409", async () => {
    Lot.create.mockRejectedValue(new UniqueConstraintError({ message: "dup" }));

    const response = await call("post", "/lots", BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Lot already exists" });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call("post", "/lots", BODY, null);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const dispatcher = await call(
      "post",
      "/lots",
      BODY,
      tokenFor("dispatcher"),
    );
    expect(dispatcher.status).toBe(403);
    expect(dispatcher.body).toEqual({ message: "Forbidden" });
    expect(Lot.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    Lot.create.mockRejectedValue(new Error("database exploded"));

    const response = await call("post", "/lots", BODY);

    expect(response.status).toBe(500);
  });
});
