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
 * Builds a stored shelf double as returned by Sequelize.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The shelf double.
 */
function storedShelf(overrides = {}) {
  return {
    id: 1,
    warehouse_id: 1,
    code: "A1",
    name: null,
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
  Shelf.create.mockReset();
  Shelf.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("PUT /shelves/:id", () => {
  it("updates the editable fields and answers 202", async () => {
    const shelf = {
      ...storedShelf(),
      sections: [],
      update: jest.fn(function update(values) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
    };
    Shelf.findByPk.mockResolvedValue(shelf);

    const response = await call("put", "/shelves/1", {
      code: "  b2  ",
      name: " Estante B2 ",
      description: " Lado izquierdo ",
    });

    expect(response.status).toBe(202);
    expect(shelf.update).toHaveBeenCalledWith({
      code: "B2",
      name: "Estante B2",
      description: "Lado izquierdo",
    });
    expect(response.body).toEqual({
      id: 1,
      warehouse_id: 1,
      code: "B2",
      name: "Estante B2",
      description: "Lado izquierdo",
      sections: [],
    });
  });

  it("responds 422 when warehouse_id is sent", async () => {
    const response = await call("put", "/shelves/1", {
      warehouse_id: 2,
      code: "B2",
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { warehouse_id: "warehouse_id cannot be changed" },
    });
    expect(Shelf.findByPk).not.toHaveBeenCalled();
  });

  it("responds 400 when no editable field is sent", async () => {
    Shelf.findByPk.mockResolvedValue(storedShelf());

    const response = await call("put", "/shelves/1", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "At least one field is required",
    });
  });

  it("responds 409 for a duplicated code", async () => {
    Shelf.findByPk.mockResolvedValue({
      ...storedShelf(),
      update: jest
        .fn()
        .mockRejectedValue(new UniqueConstraintError({ message: "dup" })),
    });

    const response = await call("put", "/shelves/1", { code: "B2" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Shelf already exists" });
  });

  it("responds 404 and 422 for the id", async () => {
    Shelf.findByPk.mockResolvedValue(null);

    const missing = await call("put", "/shelves/999", { code: "B2" });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Shelf not found" });

    const invalid = await call("put", "/shelves/abc", { code: "B2" });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid shelf id" } });
  });

  it("responds 403 for a read-only role", async () => {
    const response = await call(
      "put",
      "/shelves/1",
      { code: "B2" },
      tokenFor("dispatcher"),
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});

describe("DELETE /shelves/:id", () => {
  it("removes the shelf and answers 204", async () => {
    const shelf = {
      ...storedShelf(),
      sections: [],
      destroy: jest.fn().mockResolvedValue(),
    };
    Shelf.findByPk.mockResolvedValue(shelf);

    const response = await call("delete", "/shelves/1");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(shelf.destroy).toHaveBeenCalledTimes(1);
  });

  it("answers 409 Shelf has lots when the foreign key blocks it", async () => {
    const shelf = {
      ...storedShelf(),
      sections: [],
      destroy: jest
        .fn()
        .mockRejectedValue(new ForeignKeyConstraintError({ message: "fk" })),
    };
    Shelf.findByPk.mockResolvedValue(shelf);

    const response = await call("delete", "/shelves/1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Shelf has lots" });
  });

  it("responds 404 for an unknown shelf", async () => {
    Shelf.findByPk.mockResolvedValue(null);

    const response = await call("delete", "/shelves/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Shelf not found" });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call("delete", "/shelves/1", undefined, null);
    expect(anonymous.status).toBe(401);

    const seller = await call(
      "delete",
      "/shelves/1",
      undefined,
      tokenFor("seller"),
    );
    expect(seller.status).toBe(403);
    expect(seller.body).toEqual({ message: "Forbidden" });
  });
});
