process.env.JWT_SECRET = "test-secret";

jest.mock("../models/supplier", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/city", () => ({ findByPk: jest.fn() }));
jest.mock("../models/state", () => ({ findByPk: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const Supplier = require("../models/supplier");
const User = require("../models/user");
const listRouter = require("./list");
const { LIST_ORDER, LOCATION_INCLUDE } = require("./repository");

const app = express();
app.use(express.json());
app.use("/suppliers", listRouter);

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
const CITY = { id: 10, name: "Maracay", state_id: 4 };
const STATE = { id: 4, name: "Aragua", code: "VE-D" };
const stored = [
  {
    id: 1,
    name: "Distribuidora La Salud C.A.",
    identification: "J-12345678-9",
    email: "ventas@lasalud.com",
    phone: "+58 212 555-1234",
    observations: null,
    address: "Av. Principal, Galpón 4",
    city_id: 10,
    state_id: 4,
    city: CITY,
    state: STATE,
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
 * @param {string} path - Request path under /suppliers.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function get(path, token = tokenFor()) {
  const req = request(app).get(`/suppliers${path}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  Supplier.findAll.mockReset();
  Supplier.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /suppliers", () => {
  it.each(ALL_ROLES)(
    "returns the nested suppliers for an authenticated %s",
    async (role) => {
      Supplier.findAll.mockResolvedValue(stored);

      const response = await get("/", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          ...stored[0],
          city: { id: 10, name: "Maracay" },
          state: STATE,
        },
      ]);
      expect(response.body[0]).not.toHaveProperty("createdAt");
      expect(response.body[0]).not.toHaveProperty("updatedAt");
      expect(Supplier.findAll).toHaveBeenCalledWith({
        order: LIST_ORDER,
        include: LOCATION_INCLUDE,
      });
    },
  );

  it("returns an empty array when there are no suppliers", async () => {
    Supplier.findAll.mockResolvedValue([]);

    const response = await get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("filters by state_id", async () => {
    Supplier.findAll.mockResolvedValue([]);

    await get("/?state_id=4");

    expect(Supplier.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: LOCATION_INCLUDE,
      where: { state_id: 4 },
    });
  });

  it("filters by city_id", async () => {
    Supplier.findAll.mockResolvedValue([]);

    await get("/?city_id=10");

    expect(Supplier.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: LOCATION_INCLUDE,
      where: { city_id: 10 },
    });
  });

  it("searches by name or identification with a case-insensitive pattern", async () => {
    Supplier.findAll.mockResolvedValue([]);

    await get("/?q=salud");

    expect(Supplier.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: LOCATION_INCLUDE,
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: "%salud%" } },
          { identification: { [Op.iLike]: "%salud%" } },
        ],
      },
    });
  });

  it("combines every filter", async () => {
    Supplier.findAll.mockResolvedValue([]);

    await get("/?state_id=4&city_id=10&q=salud");

    expect(Supplier.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: LOCATION_INCLUDE,
      where: {
        state_id: 4,
        city_id: 10,
        [Op.or]: [
          { name: { [Op.iLike]: "%salud%" } },
          { identification: { [Op.iLike]: "%salud%" } },
        ],
      },
    });
  });

  it.each([
    ["state_id", "abc", { state_id: "Invalid state" }],
    ["state_id", "0", { state_id: "Invalid state" }],
    ["city_id", "1.5", { city_id: "Invalid city id" }],
    ["city_id", "-1", { city_id: "Invalid city id" }],
  ])("responds 422 when %s is %s", async (field, value, errors) => {
    const response = await get(`/?${field}=${value}`);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
    expect(Supplier.findAll).not.toHaveBeenCalled();
  });

  it("responds 401 without a token", async () => {
    const response = await get("/", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Supplier.findAll).not.toHaveBeenCalled();
  });

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get("/");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(Supplier.findAll).not.toHaveBeenCalled();
  });
});

describe("GET /suppliers/:id", () => {
  it.each(ALL_ROLES)(
    "returns one nested supplier for an authenticated %s",
    async (role) => {
      Supplier.findByPk.mockResolvedValue(stored[0]);

      const response = await get("/1", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...stored[0],
        city: { id: 10, name: "Maracay" },
        state: STATE,
      });
      expect(Supplier.findByPk).toHaveBeenCalledWith(1, {
        include: LOCATION_INCLUDE,
      });
    },
  );

  it("responds 404 when the supplier does not exist", async () => {
    Supplier.findByPk.mockResolvedValue(null);

    const response = await get("/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Supplier not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await get(`/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid supplier id" },
      });
      expect(Supplier.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 without a token", async () => {
    const response = await get("/1", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
