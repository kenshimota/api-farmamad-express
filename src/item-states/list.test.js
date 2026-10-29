process.env.JWT_SECRET = "test-secret";

jest.mock("../models/item-state", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const ItemState = require("../models/item-state");
const User = require("../models/user");
const listRouter = require("./list");

const app = express();
app.use(express.json());
app.use("/item-states", listRouter);

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
const storedItemStates = [
  {
    id: 2,
    name: "damaged",
    label: "Maltratado",
    description: null,
    is_sellable: false,
  },
  {
    id: 1,
    name: "sellable",
    label: "Vendible",
    description: null,
    is_sellable: true,
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
 * @param {string} path - Request path under /item-states.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function get(path, token = tokenFor()) {
  const req = request(app).get(`/item-states${path}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  ItemState.create.mockReset();
  ItemState.findAll.mockReset();
  ItemState.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /item-states", () => {
  it.each(ALL_ROLES)(
    "returns the public item states for an authenticated %s",
    async (role) => {
      ItemState.findAll.mockResolvedValue(storedItemStates);

      const response = await get("/", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(storedItemStates);
      expect(response.body[0]).not.toHaveProperty("createdAt");
      expect(response.body[0]).not.toHaveProperty("updatedAt");
      expect(ItemState.findAll).toHaveBeenCalledWith({
        order: [["name", "ASC"]],
      });
    },
  );

  it.each([
    ["true", true],
    ["false", false],
  ])("filters by is_sellable=%s", async (value, expected) => {
    ItemState.findAll.mockResolvedValue([]);

    const response = await get(`/?is_sellable=${value}`);

    expect(response.status).toBe(200);
    expect(ItemState.findAll).toHaveBeenCalledWith({
      order: [["name", "ASC"]],
      where: { is_sellable: expected },
    });
  });

  it.each(["yes", "1", ""])(
    "responds 422 when is_sellable is %p",
    async (value) => {
      const response = await get(`/?is_sellable=${value}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { is_sellable: "is_sellable must be a boolean" },
      });
      expect(ItemState.findAll).not.toHaveBeenCalled();
    },
  );

  it("returns an empty array when there are no item states", async () => {
    ItemState.findAll.mockResolvedValue([]);

    const response = await get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responds 401 without a token", async () => {
    const response = await get("/", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(ItemState.findAll).not.toHaveBeenCalled();
  });

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get("/");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(ItemState.findAll).not.toHaveBeenCalled();
  });
});

describe("GET /item-states/:id", () => {
  it.each(ALL_ROLES)(
    "returns one public item state for an authenticated %s",
    async (role) => {
      ItemState.findByPk.mockResolvedValue(storedItemStates[0]);

      const response = await get("/2", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(storedItemStates[0]);
      expect(ItemState.findByPk).toHaveBeenCalledWith(2);
    },
  );

  it("responds 404 when the item state does not exist", async () => {
    ItemState.findByPk.mockResolvedValue(null);

    const response = await get("/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Item state not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await get(`/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid item state id" },
      });
      expect(ItemState.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 without a token", async () => {
    const response = await get("/1", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
