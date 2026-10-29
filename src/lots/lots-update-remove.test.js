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
  stock: 100,
  reserved: 10,
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
});

describe("PUT /lots/:id", () => {
  it("replaces the editable fields and answers 202 with available", async () => {
    const lot = storedLot();
    Lot.findByPk.mockResolvedValueOnce(lot).mockResolvedValueOnce(storedLot());

    const response = await call("put", "/lots/1", BODY);

    expect(response.status).toBe(202);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: 1,
        stock: 100,
        reserved: 10,
        available: 90,
      }),
    );
    expect(lot.update).toHaveBeenCalledWith(BODY, {
      transaction: { id: "tx" },
    });
  });

  it("ignores id, available and timestamps", async () => {
    const lot = storedLot();
    Lot.findByPk.mockResolvedValueOnce(lot).mockResolvedValueOnce(storedLot());

    await call("put", "/lots/1", {
      ...BODY,
      id: 99,
      available: 1,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
    });

    expect(lot.update).toHaveBeenCalledWith(BODY, {
      transaction: { id: "tx" },
    });
  });

  it("responds 400 when a required field is missing", async () => {
    const { stock, ...withoutStock } = BODY;

    const response = await call("put", "/lots/1", withoutStock);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message:
        "number, product_id, expiration_date, item_state_id, stock, reserved, warehouse_id, shelf_id and section_id are required",
    });
    expect(Lot.findByPk).not.toHaveBeenCalled();
  });

  it("responds 422 when reserved exceeds stock", async () => {
    const response = await call("put", "/lots/1", {
      ...BODY,
      stock: 5,
      reserved: 6,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { reserved: "reserved cannot exceed stock" },
    });
  });

  it("responds 404 when the lot does not exist", async () => {
    Lot.findByPk.mockResolvedValue(null);

    const response = await call("put", "/lots/999", BODY);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Lot not found" });
  });

  it("responds 422 for an invalid id", async () => {
    const response = await call("put", "/lots/abc", BODY);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid lot id" } });
  });

  it("responds 409 when the new pair belongs to another lot", async () => {
    Lot.findByPk.mockResolvedValue(storedLot());
    Lot.findOne.mockResolvedValue(storedLot({ id: 99 }));

    const response = await call("put", "/lots/1", BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Lot already exists" });
  });

  it("revalidates the location coherence", async () => {
    Lot.findByPk.mockResolvedValue(storedLot());
    Shelf.findByPk.mockResolvedValue({ id: 1, warehouse_id: 2 });

    const response = await call("put", "/lots/1", BODY);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { shelf_id: "Shelf does not belong to the warehouse" },
    });
  });

  it("responds 422 when a reference does not exist", async () => {
    Lot.findByPk.mockResolvedValue(storedLot());
    Product.findByPk.mockResolvedValue(null);

    const response = await call("put", "/lots/1", BODY);

    expect(response.status).toBe(422);
    expect(response.body.errors).toHaveProperty("product_id");
  });

  it("responds 401 and 403 for unauthorized writes", async () => {
    const anonymous = await call("put", "/lots/1", BODY, null);
    expect(anonymous.status).toBe(401);

    const dispatcher = await call(
      "put",
      "/lots/1",
      BODY,
      tokenFor("dispatcher"),
    );
    expect(dispatcher.status).toBe(403);
    expect(dispatcher.body).toEqual({ message: "Forbidden" });
  });
});

describe("DELETE /lots/:id", () => {
  it("deletes a lot without stock or reservations and answers 204", async () => {
    const lot = storedLot({ stock: 0, reserved: 0 });
    Lot.findByPk.mockResolvedValue(lot);

    const response = await call("delete", "/lots/1");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(lot.destroy).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ stock: 1, reserved: 0 }],
    [{ stock: 5, reserved: 1 }],
    [{ stock: 0, reserved: 1 }],
  ])("responds 409 when quantities are not zero: %p", async (quantities) => {
    const lot = storedLot(quantities);
    Lot.findByPk.mockResolvedValue(lot);

    const response = await call("delete", "/lots/1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Lot has stock or reservations",
    });
    expect(lot.destroy).not.toHaveBeenCalled();
  });

  it("responds 404 when the lot does not exist", async () => {
    Lot.findByPk.mockResolvedValue(null);

    const response = await call("delete", "/lots/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Lot not found" });
  });

  it("responds 422 for an invalid id", async () => {
    const response = await call("delete", "/lots/abc");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid lot id" } });
  });
});
