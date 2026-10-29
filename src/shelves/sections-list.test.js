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

const app = express();
app.use(express.json());
app.use("/shelves", shelvesRouter);

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const SHELF = { id: 1, warehouse_id: 1, code: "A1", name: null };

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
  Shelf.findByPk.mockReset();
  ShelfSection.findAll.mockReset();
  ShelfSection.findOne.mockReset();
  User.findByPk.mockReset();
  Shelf.findByPk.mockResolvedValue(SHELF);
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /shelves/:shelf_id/sections", () => {
  it.each(["admin", "seller", "manager_warehouse", "dispatcher"])(
    "allows a %s to list the sections",
    async (role) => {
      ShelfSection.findAll.mockResolvedValue([]);

      const response = await get("/shelves/1/sections", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(ShelfSection.findAll).toHaveBeenCalledWith({
        where: { shelf_id: 1 },
        order: [["code", "ASC"]],
      });
    },
  );

  it("serializes the sections without audit fields", async () => {
    ShelfSection.findAll.mockResolvedValue([
      {
        id: 2,
        shelf_id: 1,
        code: "A1-01",
        name: null,
        description: null,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
      },
    ]);

    const response = await get("/shelves/1/sections");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 2,
        shelf_id: 1,
        code: "A1-01",
        name: null,
        description: null,
      },
    ]);
  });

  it("responds 404 when the shelf does not exist", async () => {
    Shelf.findByPk.mockResolvedValue(null);

    const response = await get("/shelves/999/sections");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Shelf not found" });
  });

  it("responds 422 for an invalid shelf id", async () => {
    const response = await get("/shelves/abc/sections");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { shelf_id: "Invalid shelf id" } });
  });

  it("responds 403 for a role without read access", async () => {
    const response = await get("/shelves/1/sections", tokenFor("customer"));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("responds 401 without a token", async () => {
    const response = await get("/shelves/1/sections", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});

describe("GET /shelves/:shelf_id/sections/:section_id", () => {
  it("returns the section of the shelf", async () => {
    ShelfSection.findOne.mockResolvedValue({
      id: 2,
      shelf_id: 1,
      code: "A1-01",
      name: "Nivel 1",
      description: null,
    });

    const response = await get("/shelves/1/sections/2");

    expect(response.status).toBe(200);
    expect(ShelfSection.findOne).toHaveBeenCalledWith({
      where: { id: 2, shelf_id: 1 },
    });
    expect(response.body).toEqual({
      id: 2,
      shelf_id: 1,
      code: "A1-01",
      name: "Nivel 1",
      description: null,
    });
  });

  it("responds 404 when the section belongs to another shelf", async () => {
    ShelfSection.findOne.mockResolvedValue(null);

    const response = await get("/shelves/1/sections/99");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Section not found" });
  });

  it("responds 422 for an invalid section id", async () => {
    const response = await get("/shelves/1/sections/abc");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { section_id: "Invalid section id" },
    });
  });
});
