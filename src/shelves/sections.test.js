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
const { UniqueConstraintError } = require("sequelize");
const Shelf = require("../models/shelf");
const ShelfSection = require("../models/shelf-section");
const User = require("../models/user");
const shelvesRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/shelves", shelvesRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

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
 * Sends an authenticated request to the shelves router.
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
  Shelf.findByPk.mockReset();
  ShelfSection.create.mockReset();
  ShelfSection.findOne.mockReset();
  User.findByPk.mockReset();
  Shelf.findByPk.mockResolvedValue(SHELF);
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("POST /shelves/:shelf_id/sections", () => {
  it.each(["admin", "manager_warehouse"])(
    "allows a %s to create a section and answers 201",
    async (role) => {
      ShelfSection.create.mockImplementation(async (values) => ({
        id: 2,
        ...values,
      }));

      const response = await call(
        "post",
        "/shelves/1/sections",
        { code: "a1-01", name: " Nivel 1 " },
        tokenFor(role),
      );

      expect(response.status).toBe(201);
      expect(ShelfSection.create).toHaveBeenCalledWith({
        shelf_id: 1,
        code: "A1-01",
        name: "Nivel 1",
        description: null,
      });
      expect(response.body).toEqual({
        id: 2,
        shelf_id: 1,
        code: "A1-01",
        name: "Nivel 1",
        description: null,
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("responds 404 when the shelf does not exist", async () => {
    Shelf.findByPk.mockResolvedValue(null);

    const response = await call("post", "/shelves/999/sections", {
      code: "A1-01",
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Shelf not found" });
    expect(ShelfSection.create).not.toHaveBeenCalled();
  });

  it("responds 400 when code is missing", async () => {
    const response = await call("post", "/shelves/1/sections", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "code is required" });
    expect(ShelfSection.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "" }, "code"],
    [{ code: "A 1" }, "code"],
    [{ code: "A1!" }, "code"],
    [{ code: "A1", name: "x".repeat(101) }, "name"],
    [{ code: "A1", description: "x".repeat(256) }, "description"],
  ])("responds 422 when the body is invalid in %p", async (body, field) => {
    const response = await call("post", "/shelves/1/sections", body);

    expect(response.status).toBe(422);
    expect(response.body.errors).toHaveProperty(field);
    expect(ShelfSection.create).not.toHaveBeenCalled();
  });

  it("responds 422 for an invalid shelf_id in the route", async () => {
    const response = await call("post", "/shelves/abc/sections", {
      code: "A1-01",
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { shelf_id: "Invalid shelf id" } });
  });

  it("responds 409 for a duplicated code in the shelf", async () => {
    ShelfSection.create.mockRejectedValue(
      new UniqueConstraintError({ message: "dup" }),
    );

    const response = await call("post", "/shelves/1/sections", {
      code: "A1-01",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Section already exists" });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call(
      "post",
      "/shelves/1/sections",
      { code: "A1-01" },
      null,
    );
    expect(anonymous.status).toBe(401);

    const seller = await call(
      "post",
      "/shelves/1/sections",
      { code: "A1-01" },
      tokenFor("seller"),
    );
    expect(seller.status).toBe(403);
    expect(ShelfSection.create).not.toHaveBeenCalled();
  });
});
