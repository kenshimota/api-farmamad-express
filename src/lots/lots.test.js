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

describe("POST /lots", () => {
  it.each(["admin", "seller", "manager_warehouse"])(
    "allows a %s to create a lot and answers 201",
    async (role) => {
      const response = await call("post", "/lots", BODY, tokenFor(role));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 1,
        number: "L-2026-001",
        product_id: 15,
        expiration_date: "2027-03-31",
        item_state_id: 1,
        stock: 120,
        reserved: 15,
        available: 105,
        warehouse_id: 1,
        shelf_id: 1,
        section_id: 2,
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
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
      expect(Lot.create).toHaveBeenCalledWith(BODY, {
        transaction: { id: "tx" },
      });
    },
  );

  it("normalizes the number and applies zero quantity defaults", async () => {
    const body = {
      number: "  l-2026-009  ",
      product_id: 15,
      expiration_date: "2027-03-31",
      item_state_id: 1,
      warehouse_id: 1,
      shelf_id: 1,
      section_id: 2,
    };

    const response = await call("post", "/lots", body);

    expect(response.status).toBe(201);
    expect(Lot.create).toHaveBeenCalledWith(
      {
        ...body,
        number: "l-2026-009",
        stock: 0,
        reserved: 0,
      },
      { transaction: { id: "tx" } },
    );
  });

  it("drops unknown, calculated and audit fields", async () => {
    await call("post", "/lots", {
      ...BODY,
      id: 99,
      available: 500,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
    });

    expect(Lot.create).toHaveBeenCalledWith(BODY, {
      transaction: { id: "tx" },
    });
  });

  it("responds 400 with the documented message when fields are missing", async () => {
    const response = await call("post", "/lots", { number: "L-1" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message:
        "number, product_id, expiration_date, item_state_id, warehouse_id, shelf_id and section_id are required",
    });
    expect(Lot.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...BODY, number: "" }, "number"],
    [{ ...BODY, number: "x".repeat(101) }, "number"],
    [{ ...BODY, product_id: 0 }, "product_id"],
    [{ ...BODY, expiration_date: "2026-02-30" }, "expiration_date"],
    [{ ...BODY, expiration_date: "31-03-2027" }, "expiration_date"],
    [{ ...BODY, stock: -1 }, "stock"],
    [{ ...BODY, stock: 1.5 }, "stock"],
    [{ ...BODY, stock: 1000000001 }, "stock"],
    [{ ...BODY, reserved: -1 }, "reserved"],
  ])("responds 422 for invalid fields in %p", async (body, field) => {
    const response = await call("post", "/lots", body);

    expect(response.status).toBe(422);
    expect(response.body.errors).toHaveProperty(field);
    expect(Lot.create).not.toHaveBeenCalled();
  });

  it("responds 422 when reserved exceeds stock", async () => {
    const response = await call("post", "/lots", {
      ...BODY,
      stock: 10,
      reserved: 11,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { reserved: "reserved cannot exceed stock" },
    });
  });
});
