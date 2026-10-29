process.env.JWT_SECRET = "test-secret";

jest.mock("../models/item-state", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/cost", () => ({ findOne: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const ItemState = require("../models/item-state");
const User = require("../models/user");
const itemStatesRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/item-states", itemStatesRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const BODY = { name: "sellable", label: "Vendible" };
const VALIDATED_DEFAULTS = { description: null, is_sellable: false };

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
 * Sends a POST /item-states request.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body, token = tokenFor()) {
  const req = request(app).post("/item-states");

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  ItemState.create.mockReset();
  ItemState.findAll.mockReset();
  ItemState.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("POST /item-states", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create an item state and answers 201",
    async (role) => {
      ItemState.create.mockImplementation(async (values) => ({
        id: 6,
        ...values,
      }));

      const response = await post(BODY, tokenFor(role));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: 6, ...BODY, ...VALIDATED_DEFAULTS });
      expect(ItemState.create).toHaveBeenCalledWith({
        ...BODY,
        ...VALIDATED_DEFAULTS,
      });
    },
  );

  it("trims the name, label and description before persisting", async () => {
    ItemState.create.mockImplementation(async (values) => ({
      id: 6,
      ...values,
    }));

    const response = await post({
      name: "  returned  ",
      label: "  Devuelto  ",
      description: "  Devuelto por el cliente  ",
      is_sellable: true,
    });

    expect(response.status).toBe(201);
    expect(ItemState.create).toHaveBeenCalledWith({
      name: "returned",
      label: "Devuelto",
      description: "Devuelto por el cliente",
      is_sellable: true,
    });
  });

  it("drops unknown and audit fields", async () => {
    ItemState.create.mockImplementation(async (values) => ({
      id: 6,
      ...values,
    }));

    const response = await post({
      ...BODY,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(ItemState.create).toHaveBeenCalledWith({
      ...BODY,
      ...VALIDATED_DEFAULTS,
    });
  });

  it("responds 409 when the name already exists", async () => {
    ItemState.create.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );

    const response = await post(BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Item state already exists" });
  });

  it.each([{}, { name: "sellable" }, { label: "Vendible" }])(
    "responds 400 when a required field is missing in %p",
    async (body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: "name and label are required",
      });
      expect(ItemState.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: "Sellable", label: "Vendible" },
    { name: "not-valid", label: "Vendible" },
    { name: "sellable", label: "V" },
  ])("responds 422 when the body is invalid in %p", async (body) => {
    const response = await post(body);

    expect(response.status).toBe(422);
    expect(response.body.errors).toBeDefined();
    expect(ItemState.create).not.toHaveBeenCalled();
  });

  it("explains the snake_case rule for the name", async () => {
    const response = await post({ name: "Sellable", label: "Vendible" });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { name: "name must be snake_case" },
    });
  });

  it("responds 401 without a token", async () => {
    const response = await post(BODY, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(ItemState.create).not.toHaveBeenCalled();
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
      expect(ItemState.create).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await post(BODY);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(ItemState.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    ItemState.create.mockRejectedValue(new Error("database exploded"));

    const response = await post(BODY);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});

describe("router composition", () => {
  it("mounts the list router on GET /item-states", async () => {
    ItemState.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get("/item-states")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(ItemState.findAll).toHaveBeenCalledWith({
      order: [["name", "ASC"]],
    });
  });

  it("mounts the update router on PUT /item-states/:id", async () => {
    const itemState = {
      id: 1,
      name: "sellable",
      label: "Vendible",
      description: null,
      is_sellable: false,
      update: jest.fn(function update(values) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
    };
    ItemState.findByPk.mockResolvedValue(itemState);

    const response = await request(app)
      .put("/item-states/1")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ is_sellable: true });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      id: 1,
      name: "sellable",
      label: "Vendible",
      description: null,
      is_sellable: true,
    });
  });

  it("mounts the remove router on DELETE /item-states/:id", async () => {
    const itemState = {
      id: 1,
      name: "sellable",
      label: "Vendible",
      description: null,
      is_sellable: false,
      destroy: jest.fn().mockResolvedValue(),
    };
    ItemState.findByPk.mockResolvedValue(itemState);

    const response = await request(app)
      .delete("/item-states/1")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(itemState.destroy).toHaveBeenCalledTimes(1);
  });
});
