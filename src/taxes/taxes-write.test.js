process.env.JWT_SECRET = "test-secret";

jest.mock("../models/tax", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const Tax = require("../models/tax");
const User = require("../models/user");
const taxesRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/taxes", taxesRouter);
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
 * Builds a stored tax double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Stored tax double.
 */
function target(overrides = {}) {
  return {
    id: 1,
    code: "IVA",
    name: "Impuesto al Valor Agregado",
    rate: "16.00",
    description: "IVA general",
    is_active: true,
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    destroy: jest.fn().mockResolvedValue(),
    ...overrides,
  };
}

/**
 * Sends an authenticated request to the taxes router.
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
  Tax.create.mockReset();
  Tax.findAll.mockReset();
  Tax.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("PUT /taxes/:id", () => {
  it("updates the editable fields and answers 202", async () => {
    const tax = target();
    Tax.findByPk.mockResolvedValue(tax);

    const response = await call("put", "/taxes/1", {
      rate: 3.5,
      is_active: false,
      description: "  General  ",
    });

    expect(response.status).toBe(202);
    expect(tax.update).toHaveBeenCalledWith({
      rate: 3.5,
      is_active: false,
      description: "General",
    });
    expect(response.body).toEqual({
      id: 1,
      code: "IVA",
      name: "Impuesto al Valor Agregado",
      rate: 3.5,
      description: "General",
      is_active: false,
    });
  });

  it("ignores code because it is immutable", async () => {
    const tax = target();
    Tax.findByPk.mockResolvedValue(tax);

    const response = await call("put", "/taxes/1", {
      code: "OTHER",
      name: "IVA actualizado",
    });

    expect(response.status).toBe(202);
    expect(tax.update).toHaveBeenCalledWith({ name: "IVA actualizado" });
    expect(response.body.code).toBe("IVA");
  });

  it("responds 400 when no editable field is provided", async () => {
    const response = await call("put", "/taxes/1", { code: "OTHER" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "At least one field is required",
    });
    expect(Tax.findByPk).not.toHaveBeenCalled();
  });

  it.each([
    [{ rate: 101 }, { rate: "rate must be between 0 and 100" }],
    [{ rate: -1 }, { rate: "rate must be between 0 and 100" }],
    [{ rate: 3.555 }, { rate: "rate must have at most 2 decimals" }],
    [{ name: "A" }, { name: expect.stringContaining("name") }],
  ])("responds 422 when the body is invalid in %p", async (body, errors) => {
    const response = await call("put", "/taxes/1", body);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
    expect(Tax.findByPk).not.toHaveBeenCalled();
  });

  it("responds 409 when the code already exists", async () => {
    const tax = target();
    tax.update.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );
    Tax.findByPk.mockResolvedValue(tax);

    const response = await call("put", "/taxes/1", { name: "IGTF" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Tax already exists" });
  });

  it("responds 404 for an unknown tax", async () => {
    Tax.findByPk.mockResolvedValue(null);

    const response = await call("put", "/taxes/999", { rate: 3.5 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Tax not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await call("put", `/taxes/${id}`, { rate: 3.5 });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors: { id: "Invalid tax id" } });
      expect(Tax.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call("put", "/taxes/1", { rate: 3.5 }, null);
    expect(anonymous.status).toBe(401);

    const seller = await call(
      "put",
      "/taxes/1",
      { rate: 3.5 },
      tokenFor("seller"),
    );
    expect(seller.status).toBe(403);
    expect(seller.body).toEqual({ message: "Forbidden" });
    expect(Tax.findByPk).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    const tax = target();
    tax.update.mockRejectedValue(new Error("database exploded"));
    Tax.findByPk.mockResolvedValue(tax);

    const response = await call("put", "/taxes/1", { rate: 3.5 });

    expect(response.status).toBe(500);
  });
});

describe("DELETE /taxes/:id", () => {
  it("removes the tax and answers 204", async () => {
    const tax = target();
    Tax.findByPk.mockResolvedValue(tax);

    const response = await call("delete", "/taxes/1");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(tax.destroy).toHaveBeenCalledTimes(1);
  });

  it("responds 409 Tax is in use when a foreign key blocks the delete", async () => {
    const tax = target();
    tax.destroy.mockRejectedValue(
      new ForeignKeyConstraintError({ message: "foreign key" }),
    );
    Tax.findByPk.mockResolvedValue(tax);

    const response = await call("delete", "/taxes/1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Tax is in use" });
  });

  it("responds 404 for an unknown tax", async () => {
    Tax.findByPk.mockResolvedValue(null);

    const response = await call("delete", "/taxes/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Tax not found" });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call("delete", "/taxes/1", undefined, null);
    expect(anonymous.status).toBe(401);

    const seller = await call(
      "delete",
      "/taxes/1",
      undefined,
      tokenFor("seller"),
    );
    expect(seller.status).toBe(403);
    expect(seller.body).toEqual({ message: "Forbidden" });
  });

  it("forwards unexpected persistence errors", async () => {
    const tax = target();
    tax.destroy.mockRejectedValue(new Error("database exploded"));
    Tax.findByPk.mockResolvedValue(tax);

    const response = await call("delete", "/taxes/1");

    expect(response.status).toBe(500);
  });
});
