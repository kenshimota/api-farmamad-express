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
const { UniqueConstraintError } = require("sequelize");
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
const BODY = {
  code: "IVA",
  name: "Impuesto al Valor Agregado",
  rate: 16,
};

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
 * Builds a stored tax double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The tax double.
 */
function storedTax(overrides = {}) {
  return {
    id: 1,
    code: "IVA",
    name: "Impuesto al Valor Agregado",
    rate: "16.00",
    description: "IVA general",
    is_active: true,
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

describe("POST /taxes", () => {
  it("allows an admin to create a tax and answers 201", async () => {
    Tax.create.mockImplementation(async (values) => ({ id: 1, ...values }));

    const response = await call("post", "/taxes", BODY);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 1,
      code: "IVA",
      name: "Impuesto al Valor Agregado",
      rate: 16,
      description: null,
      is_active: true,
    });
    expect(Tax.create).toHaveBeenCalledWith({
      code: "IVA",
      name: "Impuesto al Valor Agregado",
      rate: 16,
      description: null,
      is_active: true,
    });
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body).not.toHaveProperty("updatedAt");
  });

  it("normalizes the code and trims the optional fields", async () => {
    Tax.create.mockImplementation(async (values) => ({ id: 1, ...values }));

    const response = await call("post", "/taxes", {
      code: "  igtf  ",
      name: "  IGTF  ",
      rate: "3.50",
      description: "  General  ",
    });

    expect(response.status).toBe(201);
    expect(Tax.create).toHaveBeenCalledWith({
      code: "IGTF",
      name: "IGTF",
      rate: 3.5,
      description: "General",
      is_active: true,
    });
  });

  it("responds 400 when required fields are missing", async () => {
    const response = await call("post", "/taxes", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "code, name and rate are required",
    });
    expect(Tax.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ rate: 101 }, { rate: "rate must be between 0 and 100" }],
    [{ rate: -1 }, { rate: "rate must be between 0 and 100" }],
    [{ rate: 16.123 }, { rate: "rate must have at most 2 decimals" }],
    [{ code: "A" }, { code: expect.stringContaining("code") }],
    [{ name: "A" }, { name: expect.stringContaining("name") }],
  ])("responds 422 when the body is invalid in %p", async (body, errors) => {
    const response = await call("post", "/taxes", { ...BODY, ...body });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
    expect(Tax.create).not.toHaveBeenCalled();
  });

  it("responds 409 when the code already exists", async () => {
    Tax.create.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );

    const response = await call("post", "/taxes", BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Tax already exists" });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call("post", "/taxes", BODY, null);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const seller = await call("post", "/taxes", BODY, tokenFor("seller"));
    expect(seller.status).toBe(403);
    expect(seller.body).toEqual({ message: "Forbidden" });
    expect(Tax.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    Tax.create.mockRejectedValue(new Error("database exploded"));

    const response = await call("post", "/taxes", BODY);

    expect(response.status).toBe(500);
  });
});

describe("GET /taxes", () => {
  it.each(["admin", "seller", "manager_warehouse", "dispatcher"])(
    "allows a %s to list taxes",
    async (role) => {
      Tax.findAll.mockResolvedValue([storedTax()]);

      const response = await call("get", "/taxes", undefined, tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          code: "IVA",
          name: "Impuesto al Valor Agregado",
          rate: 16,
          description: "IVA general",
          is_active: true,
        },
      ]);
      expect(Tax.findAll).toHaveBeenCalledWith({ order: [["code", "ASC"]] });
    },
  );

  it.each([true, false])("filters by is_active=%p", async (isActive) => {
    Tax.findAll.mockResolvedValue([]);

    const response = await call("get", `/taxes?is_active=${isActive}`);

    expect(response.status).toBe(200);
    expect(Tax.findAll).toHaveBeenCalledWith({
      order: [["code", "ASC"]],
      where: { is_active: isActive },
    });
  });

  it("responds 422 for an invalid is_active filter", async () => {
    const response = await call("get", "/taxes?is_active=maybe");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { is_active: "Invalid is_active" },
    });
    expect(Tax.findAll).not.toHaveBeenCalled();
  });

  it.each(["support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await call("get", "/taxes", undefined, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 401 without a token", async () => {
    const response = await call("get", "/taxes", undefined, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});

describe("GET /taxes/:id", () => {
  it("returns the tax detail", async () => {
    Tax.findByPk.mockResolvedValue(storedTax());

    const response = await call("get", "/taxes/1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 1,
      code: "IVA",
      name: "Impuesto al Valor Agregado",
      rate: 16,
      description: "IVA general",
      is_active: true,
    });
  });

  it("responds 404 when the tax does not exist", async () => {
    Tax.findByPk.mockResolvedValue(null);

    const response = await call("get", "/taxes/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Tax not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await call("get", `/taxes/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors: { id: "Invalid tax id" } });
      expect(Tax.findByPk).not.toHaveBeenCalled();
    },
  );
});
