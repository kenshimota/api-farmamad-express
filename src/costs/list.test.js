process.env.JWT_SECRET = "test-secret";

jest.mock("../models/cost", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/product", () => ({ findByPk: jest.fn() }));
jest.mock("../models/item-state", () => ({ findByPk: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const Cost = require("../models/cost");
const User = require("../models/user");
const listRouter = require("./list");

const app = express();
app.use(express.json());
app.use("/costs", listRouter);
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
 * Builds a stored cost returned by Sequalize.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Stored cost double.
 */
function cost(overrides = {}) {
  return {
    id: 1,
    product_id: 15,
    item_state_id: 2,
    cost: "12.50",
    item_state: {
      id: 2,
      name: "damaged",
      label: "Maltratado",
      is_sellable: false,
    },
    ...overrides,
  };
}

/**
 * Sends a GET request with an optional token.
 * @param {string} path - Request path.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function get(path, token = tokenFor()) {
  const req = request(app).get(path);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  Cost.findAll.mockReset();
  Cost.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("GET /costs", () => {
  it.each(["admin", "seller", "manager_warehouse"])(
    "allows a %s to list costs",
    async (role) => {
      Cost.findAll.mockResolvedValue([cost()]);

      const response = await get("/costs", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          product_id: 15,
          item_state_id: 2,
          cost: 12.5,
          item_state: {
            id: 2,
            name: "damaged",
            label: "Maltratado",
            is_sellable: false,
          },
        },
      ]);
    },
  );

  it("returns an empty array when there are no costs", async () => {
    Cost.findAll.mockResolvedValue([]);

    const response = await get("/costs");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("passes the optional filters to the repository", async () => {
    Cost.findAll.mockResolvedValue([]);

    await get("/costs?product_id=15&item_state_id=2");

    expect(Cost.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { product_id: 15, item_state_id: 2 },
      }),
    );
  });

  it.each([
    [{ product_id: "abc" }, "Invalid product id"],
    [{ item_state_id: "abc" }, "Invalid item state id"],
  ])("responds 422 for an invalid filter in %p", async (query, message) => {
    const key = Object.keys(query)[0];
    const response = await get(
      `/costs?${key}=${encodeURIComponent(query[key])}`,
    );

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { [key]: message } });
    expect(Cost.findAll).not.toHaveBeenCalled();
  });

  it("responds 401 without a token", async () => {
    const response = await get("/costs", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await get("/costs", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Cost.findAll).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get("/costs");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});

describe("GET /costs/product/:product_id", () => {
  it("returns the costs of one product", async () => {
    Cost.findAll.mockResolvedValue([cost()]);

    const response = await get(
      "/costs/product/15",
      tokenFor("manager_warehouse"),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ product_id: 15, cost: 12.5 }),
    ]);
    expect(Cost.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { product_id: 15 } }),
    );
  });

  it("returns an empty array when the product has no costs", async () => {
    Cost.findAll.mockResolvedValue([]);

    const response = await get("/costs/product/15");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the product id is %s",
    async (id) => {
      const response = await get(`/costs/product/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { product_id: "Invalid product id" },
      });
      expect(Cost.findAll).not.toHaveBeenCalled();
    },
  );
});

describe("GET /costs/:id", () => {
  it("returns one cost for an allowed role", async () => {
    Cost.findByPk.mockResolvedValue(cost());

    const response = await get("/costs/1", tokenFor("manager_warehouse"));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 1,
      product_id: 15,
      item_state_id: 2,
      cost: 12.5,
      item_state: {
        id: 2,
        name: "damaged",
        label: "Maltratado",
        is_sellable: false,
      },
    });
  });

  it("responds 404 when the cost does not exist", async () => {
    Cost.findByPk.mockResolvedValue(null);

    const response = await get("/costs/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Cost not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await get(`/costs/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors: { id: "Invalid cost id" } });
      expect(Cost.findByPk).not.toHaveBeenCalled();
    },
  );
});
