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
const { Op } = require("sequelize");
const Lot = require("../models/lot");
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
    number: "L-2026-001",
    product_id: 15,
    expiration_date: "2027-03-31",
    item_state_id: 1,
    stock: 120,
    reserved: 15,
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
    ...overrides,
  };
}

/**
 * Sends an authenticated request to the lots router.
 * @param {string} method - HTTP method in lowercase.
 * @param {string} path - Request path.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function call(method, path, token = tokenFor()) {
  const req = request(app)[method](path);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  User.findByPk.mockResolvedValue(AUTH_USER);
  Lot.findAll.mockResolvedValue([storedLot()]);
  Lot.findByPk.mockResolvedValue(storedLot());
});

describe("GET /lots", () => {
  it.each(["admin", "seller", "manager_warehouse", "dispatcher"])(
    "allows a %s to list lots",
    async (role) => {
      const response = await call("get", "/lots", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual(
        expect.objectContaining({
          id: 1,
          available: 105,
          product: { id: 15, name: "Ibuprofeno 800 mg", reference: "IBU-800" },
          section: { id: 2, code: "A1-02", name: "Nivel 2" },
        }),
      );
      expect(Lot.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [
            ["expiration_date", "ASC"],
            ["id", "ASC"],
          ],
          include: expect.arrayContaining([
            expect.objectContaining({ as: "product" }),
            expect.objectContaining({ as: "item_state" }),
            expect.objectContaining({ as: "warehouse" }),
            expect.objectContaining({ as: "shelf" }),
            expect.objectContaining({ as: "section" }),
          ]),
        }),
      );
    },
  );

  it("applies every filter and builds the expiration conditions", async () => {
    const response = await call(
      "get",
      "/lots?product_id=15&item_state_id=1&warehouse_id=1&shelf_id=1&section_id=2&number=l-2026-001&expired=false&expiring_before=2027-12-31",
    );

    expect(response.status).toBe(200);
    const query = Lot.findAll.mock.calls[0][0];

    expect(query.where).toMatchObject({
      product_id: 15,
      item_state_id: 1,
      warehouse_id: 1,
      shelf_id: 1,
      section_id: 2,
      number: { [Op.iLike]: "l-2026-001" },
    });
    expect(query.where.expiration_date[Op.and]).toEqual([
      { [Op.gte]: expect.anything() },
      { [Op.lte]: "2027-12-31" },
    ]);
  });

  it("filters expired lots with a strict date comparison", async () => {
    await call("get", "/lots?expired=true");

    const query = Lot.findAll.mock.calls[0][0];

    expect(query.where.expiration_date).toEqual({ [Op.lt]: expect.anything() });
  });

  it("answers an empty array without adding a where clause", async () => {
    Lot.findAll.mockResolvedValue([]);

    const response = await call("get", "/lots");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(Lot.findAll.mock.calls[0][0]).not.toHaveProperty("where");
  });

  it.each([
    "product_id=abc",
    "item_state_id=0",
    "warehouse_id=1.5",
    "shelf_id=abc",
    "section_id=-1",
    "number=",
    "number=x".repeat(1) + "y".repeat(100),
    "expired=maybe",
    "expiring_before=2026-02-30",
  ])("responds 422 for the invalid filter %s", async (query) => {
    const response = await call("get", `/lots?${query}`);

    expect(response.status).toBe(422);
    expect(Object.keys(response.body.errors)).toHaveLength(1);
    expect(Lot.findAll).not.toHaveBeenCalled();
  });

  it("responds 401 and 403 for unauthorized reads", async () => {
    const anonymous = await call("get", "/lots", null);
    expect(anonymous.status).toBe(401);

    const support = await call("get", "/lots", tokenFor("support"));
    expect(support.status).toBe(403);
    expect(support.body).toEqual({ message: "Forbidden" });
  });
});

describe("GET /lots/:id", () => {
  it("returns the lot with its nested relations", async () => {
    const response = await call("get", "/lots/1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: 1,
        available: 105,
        warehouse: { id: 1, name: "Bodega Central" },
        shelf: { id: 1, code: "A1", name: "Estante A1" },
      }),
    );
    expect(response.body).not.toHaveProperty("createdAt");
  });

  it("responds 404 when the lot does not exist", async () => {
    Lot.findByPk.mockResolvedValue(null);

    const response = await call("get", "/lots/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Lot not found" });
  });

  it("responds 422 for an invalid id", async () => {
    const response = await call("get", "/lots/abc");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { id: "Invalid lot id" },
    });
    expect(Lot.findByPk).not.toHaveBeenCalled();
  });
});
