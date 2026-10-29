process.env.JWT_SECRET = "test-secret";

jest.mock("../models/cost", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/product", () => ({ findByPk: jest.fn() }));
jest.mock("../models/item-state", () => ({ findByPk: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const Cost = require("../models/cost");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const User = require("../models/user");
const costsRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/costs", costsRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const BODY = { product_id: 15, item_state_id: 2, cost: 12.5 };
const ITEM_STATE = {
  id: 2,
  name: "damaged",
  label: "Maltratado",
  is_sellable: false,
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
 * Builds the stored cost returned by the repository.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Stored cost double.
 */
function storedCost(overrides = {}) {
  return {
    id: 3,
    ...BODY,
    item_state: ITEM_STATE,
    ...overrides,
  };
}

/**
 * Sends a POST /costs request.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body, token = tokenFor()) {
  const req = request(app).post("/costs");

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  Cost.create.mockReset();
  Cost.findAll.mockReset();
  Cost.findByPk.mockReset();
  Product.findByPk.mockReset();
  ItemState.findByPk.mockReset();
  User.findByPk.mockReset();
  Product.findByPk.mockResolvedValue({ id: 15 });
  ItemState.findByPk.mockResolvedValue(ITEM_STATE);
  User.findByPk.mockResolvedValue(AUTH_USER);
  Cost.create.mockImplementation(async (values) => ({ id: 3, ...values }));
  Cost.findByPk.mockResolvedValue(storedCost());
});

describe("POST /costs", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a cost and answers 201",
    async (role) => {
      const response = await post(BODY, tokenFor(role));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 3,
        product_id: 15,
        item_state_id: 2,
        cost: 12.5,
        item_state: ITEM_STATE,
      });
      expect(Cost.create).toHaveBeenCalledWith(BODY);
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("casts a numeric string and serializes the cost as a number", async () => {
    Cost.findByPk.mockResolvedValue(storedCost({ cost: "20.00" }));

    const response = await post({ ...BODY, cost: "20.00" });

    expect(response.status).toBe(201);
    expect(Cost.create).toHaveBeenCalledWith({ ...BODY, cost: 20 });
    expect(response.body.cost).toBe(20);
  });

  it("drops unknown and audit fields", async () => {
    const response = await post({
      ...BODY,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(Cost.create).toHaveBeenCalledWith(BODY);
  });

  it("responds 409 when the product and item state combination exists", async () => {
    Cost.create.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );

    const response = await post(BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Cost already exists" });
  });

  it.each([
    [{}, "product_id, item_state_id and cost are required"],
    [{ product_id: 15 }, "product_id, item_state_id and cost are required"],
    [
      { product_id: 15, item_state_id: 2 },
      "product_id, item_state_id and cost are required",
    ],
  ])("responds 400 when a required field is missing in %p", async (body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "product_id, item_state_id and cost are required",
    });
    expect(Cost.create).not.toHaveBeenCalled();
  });

  it("responds 422 when the product does not exist", async () => {
    Product.findByPk.mockResolvedValue(null);

    const response = await post(BODY);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { product_id: "Invalid product" },
    });
    expect(Cost.create).not.toHaveBeenCalled();
  });

  it("responds 422 when the item state does not exist", async () => {
    ItemState.findByPk.mockResolvedValue(null);

    const response = await post(BODY);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { item_state_id: "Invalid item state" },
    });
    expect(Cost.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...BODY, product_id: 0 }, { product_id: "Invalid product" }],
    [{ ...BODY, item_state_id: 0 }, { item_state_id: "Invalid item state" }],
    [{ ...BODY, cost: -1 }, { cost: "cost must be >= 0" }],
    [{ ...BODY, cost: 12.345 }, { cost: "cost must have at most 2 decimals" }],
    [
      { ...BODY, cost: 1000000000 },
      { cost: "cost must have at most 9 integer digits" },
    ],
  ])("responds 422 when the body is invalid in %p", async (body, errors) => {
    const response = await post(body);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
    expect(Cost.create).not.toHaveBeenCalled();
  });

  it("responds 401 without a token", async () => {
    const response = await post(BODY, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Cost.create).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await post(BODY, "not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await post(BODY, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Cost.create).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await post(BODY);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(Cost.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    Cost.create.mockRejectedValue(new Error("database exploded"));

    const response = await post(BODY);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});

describe("router composition", () => {
  it("mounts the list router on GET /costs", async () => {
    Cost.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get("/costs")
      .set("Authorization", `Bearer ${tokenFor("manager_warehouse")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(Cost.findAll).toHaveBeenCalledTimes(1);
  });
});
