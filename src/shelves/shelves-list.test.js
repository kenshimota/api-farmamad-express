process.env.JWT_SECRET = "test-secret";

jest.mock("../models/shelf", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/shelf-section", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/warehouse", () => ({ findByPk: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const Shelf = require("../models/shelf");
const ShelfSection = require("../models/shelf-section");
const User = require("../models/user");
const shelvesRouter = require("./index");
const { SECTIONS_INCLUDE } = require("./shelf-repository");

const app = express();
app.use(express.json());
app.use("/shelves", shelvesRouter);

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
 * Builds a stored shelf with its sections.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The shelf double.
 */
function storedShelf(overrides = {}) {
  return {
    id: 1,
    warehouse_id: 1,
    code: "A1",
    name: "Estante A1",
    description: "Pasillo principal",
    sections: [
      {
        id: 1,
        shelf_id: 1,
        code: "A1-01",
        name: "Nivel 1",
        description: null,
      },
    ],
    ...overrides,
  };
}

/**
 * Sends an authenticated GET request.
 * @param {string} path - Request path.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function get(path, token = tokenFor()) {
  const req = request(app).get(path);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  Shelf.findAll.mockReset();
  Shelf.findByPk.mockReset();
  ShelfSection.findAll.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /shelves", () => {
  it.each(["admin", "seller", "manager_warehouse", "dispatcher"])(
    "allows a %s to list shelves",
    async (role) => {
      Shelf.findAll.mockResolvedValue([]);

      const response = await get("/shelves", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(Shelf.findAll).toHaveBeenCalledWith({
        order: [
          ["warehouse_id", "ASC"],
          ["code", "ASC"],
        ],
      });
    },
  );

  it("filters by warehouse_id", async () => {
    Shelf.findAll.mockResolvedValue([storedShelf({ sections: undefined })]);

    const response = await get("/shelves?warehouse_id=2");

    expect(response.status).toBe(200);
    expect(Shelf.findAll).toHaveBeenCalledWith({
      order: [
        ["warehouse_id", "ASC"],
        ["code", "ASC"],
      ],
      where: { warehouse_id: 2 },
    });
    expect(response.body[0]).not.toHaveProperty("sections");
  });

  it("includes the sections ordered by code when include=sections", async () => {
    Shelf.findAll.mockResolvedValue([storedShelf()]);

    const response = await get("/shelves?include=sections");

    expect(response.status).toBe(200);
    expect(Shelf.findAll).toHaveBeenCalledWith({
      order: [
        ["warehouse_id", "ASC"],
        ["code", "ASC"],
      ],
      include: SECTIONS_INCLUDE,
    });
    expect(response.body[0].sections).toEqual([
      {
        id: 1,
        shelf_id: 1,
        code: "A1-01",
        name: "Nivel 1",
        description: null,
      },
    ]);
  });

  it.each([
    ["?warehouse_id=abc", { warehouse_id: "Invalid warehouse id" }],
    ["?warehouse_id=0", { warehouse_id: "Invalid warehouse id" }],
    ["?include=warehouse", { include: "Invalid include" }],
    ["?include=sections&include=state", { include: "Invalid include" }],
  ])("responds 422 for the invalid query %s", async (query, errors) => {
    const response = await get(`/shelves${query}`);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
    expect(Shelf.findAll).not.toHaveBeenCalled();
  });

  it.each(["support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await get("/shelves", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 401 without a token", async () => {
    const response = await get("/shelves", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});

describe("GET /shelves/:id", () => {
  it("returns the shelf with its sections", async () => {
    Shelf.findByPk.mockResolvedValue(storedShelf());

    const response = await get("/shelves/1");

    expect(response.status).toBe(200);
    expect(Shelf.findByPk).toHaveBeenCalledWith(1, {
      include: SECTIONS_INCLUDE,
    });
    expect(response.body).toEqual({
      id: 1,
      warehouse_id: 1,
      code: "A1",
      name: "Estante A1",
      description: "Pasillo principal",
      sections: [
        {
          id: 1,
          shelf_id: 1,
          code: "A1-01",
          name: "Nivel 1",
          description: null,
        },
      ],
    });
  });

  it("responds 404 when the shelf does not exist", async () => {
    Shelf.findByPk.mockResolvedValue(null);

    const response = await get("/shelves/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Shelf not found" });
  });

  it("responds 422 for an invalid id", async () => {
    const response = await get("/shelves/abc");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid shelf id" } });
  });

  it("responds 403 for a role without read access", async () => {
    const response = await get("/shelves/1", tokenFor("customer"));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});
