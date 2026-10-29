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
jest.mock("../models/lot", () => ({
  count: jest.fn(),
  getAttributes: jest.fn(() => ({})),
}));
jest.mock("../models/warehouse", () => ({ findByPk: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const {
  UniqueConstraintError,
  ForeignKeyConstraintError,
} = require("sequelize");
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
 * Builds a stored section double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The section double.
 */
function storedSection(overrides = {}) {
  return {
    id: 2,
    shelf_id: 1,
    code: "A1-01",
    name: "Nivel 1",
    description: null,
    ...overrides,
  };
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
  ShelfSection.findOne.mockReset();
  User.findByPk.mockReset();
  Shelf.findByPk.mockResolvedValue(SHELF);
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("PUT /shelves/:shelf_id/sections/:section_id", () => {
  it("updates the editable fields and answers 202", async () => {
    const section = {
      ...storedSection(),
      update: jest.fn(function update(values) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
    };
    ShelfSection.findOne.mockResolvedValue(section);

    const response = await call("put", "/shelves/1/sections/2", {
      code: " a1-02 ",
      name: " Nivel 2 ",
    });

    expect(response.status).toBe(202);
    expect(section.update).toHaveBeenCalledWith({
      code: "A1-02",
      name: "Nivel 2",
    });
    expect(response.body).toEqual({
      id: 2,
      shelf_id: 1,
      code: "A1-02",
      name: "Nivel 2",
      description: null,
    });
  });

  it("responds 422 when shelf_id is sent", async () => {
    const response = await call("put", "/shelves/1/sections/2", {
      shelf_id: 2,
      code: "A1-02",
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { shelf_id: "shelf_id cannot be changed" },
    });
    expect(ShelfSection.findOne).not.toHaveBeenCalled();
  });

  it("responds 400 when no editable field is sent", async () => {
    ShelfSection.findOne.mockResolvedValue(storedSection());

    const response = await call("put", "/shelves/1/sections/2", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "At least one field is required",
    });
  });

  it("responds 404 when the section belongs to another shelf", async () => {
    ShelfSection.findOne.mockResolvedValue(null);

    const response = await call("put", "/shelves/1/sections/2", {
      code: "A1-02",
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Section not found" });
  });

  it("responds 422 for an invalid section id", async () => {
    const response = await call("put", "/shelves/1/sections/abc", {
      code: "A1-02",
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { section_id: "Invalid section id" },
    });
  });

  it("responds 409 for a duplicated code", async () => {
    ShelfSection.findOne.mockResolvedValue({
      ...storedSection(),
      update: jest
        .fn()
        .mockRejectedValue(new UniqueConstraintError({ message: "dup" })),
    });

    const response = await call("put", "/shelves/1/sections/2", {
      code: "A1-02",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Section already exists" });
  });

  it("responds 403 for a read-only role", async () => {
    const response = await call(
      "put",
      "/shelves/1/sections/2",
      { code: "A1-02" },
      tokenFor("seller"),
    );

    expect(response.status).toBe(403);
  });
});

describe("DELETE /shelves/:shelf_id/sections/:section_id", () => {
  it("removes the section and answers 204", async () => {
    const section = {
      ...storedSection(),
      destroy: jest.fn().mockResolvedValue(),
    };
    ShelfSection.findOne.mockResolvedValue(section);

    const response = await call("delete", "/shelves/1/sections/2");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(section.destroy).toHaveBeenCalledTimes(1);
  });

  it("answers 409 Section has lots when the foreign key blocks it", async () => {
    ShelfSection.findOne.mockResolvedValue({
      ...storedSection(),
      destroy: jest
        .fn()
        .mockRejectedValue(new ForeignKeyConstraintError({ message: "fk" })),
    });

    const response = await call("delete", "/shelves/1/sections/2");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Section has lots" });
  });

  it("responds 404 when the section does not belong to the shelf", async () => {
    ShelfSection.findOne.mockResolvedValue(null);

    const response = await call("delete", "/shelves/1/sections/2");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Section not found" });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call(
      "delete",
      "/shelves/1/sections/2",
      undefined,
      null,
    );
    expect(anonymous.status).toBe(401);

    const seller = await call(
      "delete",
      "/shelves/1/sections/2",
      undefined,
      tokenFor("seller"),
    );
    expect(seller.status).toBe(403);
  });
});
