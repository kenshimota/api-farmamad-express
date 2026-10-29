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
const Warehouse = require("../models/warehouse");
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
const BODY = { warehouse_id: 1, code: "A1" };

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
  Shelf.create.mockReset();
  Shelf.findByPk.mockReset();
  Warehouse.findByPk.mockReset();
  User.findByPk.mockReset();
  Warehouse.findByPk.mockResolvedValue({ id: 1 });
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("POST /shelves", () => {
  it.each(["admin", "manager_warehouse"])(
    "allows a %s to create a shelf and answers 201",
    async (role) => {
      Shelf.create.mockImplementation(async (values) => ({
        id: 1,
        ...values,
      }));

      const response = await call("post", "/shelves", BODY, tokenFor(role));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 1,
        warehouse_id: 1,
        code: "A1",
        name: null,
        description: null,
        sections: [],
      });
      expect(Shelf.create).toHaveBeenCalledWith({
        warehouse_id: 1,
        code: "A1",
        name: null,
        description: null,
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("normalizes the code and trims the optional fields", async () => {
    Shelf.create.mockImplementation(async (values) => ({
      id: 1,
      ...values,
    }));

    const response = await call("post", "/shelves", {
      warehouse_id: 1,
      code: "  a1-b  ",
      name: "  Estante A1  ",
      description: "  Pasillo principal  ",
    });

    expect(response.status).toBe(201);
    expect(Shelf.create).toHaveBeenCalledWith({
      warehouse_id: 1,
      code: "A1-B",
      name: "Estante A1",
      description: "Pasillo principal",
    });
  });

  it("drops unknown and audit fields", async () => {
    Shelf.create.mockImplementation(async (values) => ({ id: 1, ...values }));

    await call("post", "/shelves", {
      ...BODY,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      sections: [{ id: 1 }],
    });

    expect(Shelf.create).toHaveBeenCalledWith({
      warehouse_id: 1,
      code: "A1",
      name: null,
      description: null,
    });
  });

  it("responds 422 when the warehouse does not exist", async () => {
    Warehouse.findByPk.mockResolvedValue(null);

    const response = await call("post", "/shelves", BODY);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { warehouse_id: "Invalid warehouse id" },
    });
    expect(Shelf.create).not.toHaveBeenCalled();
  });

  it.each([
    [{}, "warehouse_id and code are required"],
    [{ warehouse_id: 1 }, "warehouse_id and code are required"],
    [{ code: "A1" }, "warehouse_id and code are required"],
  ])("responds 400 when required fields are missing", async (body, message) => {
    const response = await call("post", "/shelves", body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(Shelf.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...BODY, warehouse_id: 0 }, "Invalid warehouse id"],
    [{ ...BODY, warehouse_id: "abc" }, "Invalid warehouse id"],
    [{ ...BODY, code: "" }, expect.stringContaining("code")],
    [{ ...BODY, code: "A 1" }, expect.stringContaining("code")],
    [{ ...BODY, code: "A1!" }, expect.stringContaining("code")],
    [{ ...BODY, name: "x".repeat(101) }, expect.stringContaining("name")],
    [
      { ...BODY, description: "x".repeat(256) },
      expect.stringContaining("description"),
    ],
  ])("responds 422 when the body is invalid in %p", async (body, message) => {
    const response = await call("post", "/shelves", body);

    expect(response.status).toBe(422);
    expect(Object.values(response.body.errors)[0]).toEqual(message);
    expect(Shelf.create).not.toHaveBeenCalled();
  });

  it("responds 409 for a duplicated code in the warehouse", async () => {
    Shelf.create.mockRejectedValue(
      new UniqueConstraintError({ message: "dup" }),
    );

    const response = await call("post", "/shelves", BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Shelf already exists" });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call("post", "/shelves", BODY, null);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const seller = await call("post", "/shelves", BODY, tokenFor("seller"));
    expect(seller.status).toBe(403);
    expect(seller.body).toEqual({ message: "Forbidden" });
    expect(Shelf.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    Shelf.create.mockRejectedValue(new Error("database exploded"));

    const response = await call("post", "/shelves", BODY);

    expect(response.status).toBe(500);
  });
});
