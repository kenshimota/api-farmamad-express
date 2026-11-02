process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("./service", () => ({
  orderStatusService: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { orderStatusService } = require("./service");
const router = require("./index");

const app = express();
app.use(express.json());
app.use("/order-statuses", router);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const STATUS = Object.freeze({
  id: 1,
  code: "draft",
  name: "Borrador",
  description: null,
  sort_order: 10,
  next_status_code: "request",
  is_terminal: false,
  is_system: true,
});

/**
 * Signs a JWT for the given role.
 * @param {string} [role] - Role embedded in the token.
 * @returns {string} Signed JWT.
 */
function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "admin", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Sends an authenticated request.
 * @param {string} method - HTTP method in lowercase.
 * @param {string} path - Request path.
 * @param {object} [body] - Request body.
 * @param {string|null} [token] - Bearer token.
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
  jest.clearAllMocks();
  User.findByPk.mockResolvedValue({ id: 1, isBlocked: false });
  orderStatusService.list.mockResolvedValue([STATUS]);
  orderStatusService.get.mockResolvedValue(STATUS);
  orderStatusService.create.mockResolvedValue({
    ...STATUS,
    id: 6,
    code: "on_hold",
    is_system: false,
  });
  orderStatusService.update.mockResolvedValue(STATUS);
  orderStatusService.remove.mockResolvedValue(undefined);
});

describe("order statuses router", () => {
  it("lets an authenticated customer list and read statuses", async () => {
    const list = await call("get", "/order-statuses", undefined, tokenFor());
    expect(list.status).toBe(200);
    expect(list.body).toEqual([STATUS]);

    const detail = await call(
      "get",
      "/order-statuses/1",
      undefined,
      tokenFor(),
    );
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(STATUS);
  });

  it("responds 401 without a token and 403 for other roles", async () => {
    const anonymous = await call("get", "/order-statuses", undefined, null);
    expect(anonymous.status).toBe(401);

    const dispatcher = await call(
      "get",
      "/order-statuses",
      undefined,
      tokenFor("dispatcher"),
    );
    expect(dispatcher.status).toBe(403);
  });

  it("rejects catalog writes from non-admin roles", async () => {
    for (const role of ["customer", "seller", "dispatcher"]) {
      const response = await call(
        "post",
        "/order-statuses",
        { code: "on_hold" },
        tokenFor(role),
      );
      expect(response.status).toBe(403);
    }

    expect(orderStatusService.create).not.toHaveBeenCalled();
  });

  it("creates, updates and removes statuses as admin", async () => {
    const created = await call("post", "/order-statuses", {
      code: "on_hold",
      name: "En espera",
      sort_order: 25,
      next_status_code: "generate",
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: "on_hold", is_system: false });

    const updated = await call("put", "/order-statuses/1", { name: "Nuevo" });
    expect(updated.status).toBe(200);

    const removed = await call("delete", "/order-statuses/6");
    expect(removed.status).toBe(204);
    expect(removed.body).toEqual({});
  });

  it("answers 422 for an invalid id and forwards service errors", async () => {
    const invalid = await call("get", "/order-statuses/abc");
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid order status id" } });

    orderStatusService.get.mockRejectedValue({
      status: 404,
      body: { message: "Order status not found" },
    });
    const missing = await call("get", "/order-statuses/999");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Order status not found" });
  });

  it("sends the 409 deletion errors of the service", async () => {
    orderStatusService.remove.mockRejectedValue({
      status: 409,
      body: { message: "System order status cannot be deleted" },
    });

    const response = await call("delete", "/order-statuses/1");
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "System order status cannot be deleted",
    });
  });
});
