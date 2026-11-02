process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("./service", () => ({
  orderService: { createOrder: jest.fn() },
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { orderService } = require("./service");
const router = require("./index");

const app = express();
app.use(express.json());
app.use("/orders", router);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const ITEMS = [{ product_id: 15, item_state_id: 1, quantity: 2 }];

/**
 * Signs a JWT for the given role.
 * @param {string} [role] - Role embedded in the token.
 * @returns {string} Signed JWT.
 */
function tokenFor(role = "customer") {
  return jwt.sign({ sub: 1, username: "ana", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Builds a draft order snapshot returned by the service double.
 * @returns {object} Order snapshot.
 */
function orderSnapshot() {
  return {
    id: 10,
    number: 1,
    status: "draft",
    customer_id: 8,
    user_id: 12,
    currency_id: 3,
    subtotal: "0.00",
    total: "0.00",
    payment_term_id: null,
    delivery_address: "Av. Monseñor Rivero 123",
    notes: null,
    createdAt: new Date("2026-11-01T10:00:00.000Z"),
    currency: { id: 3, code: "USD_BCV", name: "Dólar BCV", symbol: "$" },
    customer: {
      id: 8,
      fullName: "Cliente Demo",
      email: "cliente@example.com",
      direction: "Av. Monseñor Rivero 123",
    },
    items: [],
    history: [
      {
        event_type: "created",
        from_status: null,
        to_status: "draft",
        metadata: null,
        createdAt: new Date("2026-11-01T10:00:00.000Z"),
      },
    ],
  };
}

beforeEach(() => {
  orderService.createOrder.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue({ id: 1, isBlocked: false });
});

describe("POST /orders", () => {
  it("responds 401 without a token", async () => {
    const response = await request(app).post("/orders").send({ items: ITEMS });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("responds 403 for roles outside the order roles", async () => {
    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${tokenFor("dispatcher")}`)
      .send({ items: ITEMS });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });

  it("creates a customer draft without items", async () => {
    orderService.createOrder.mockResolvedValue(orderSnapshot());

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ notes: "Entregar por la tarde" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: 10,
      status: "draft",
      subtotal: 0,
      total: 0,
      items: [],
      history: [
        {
          event_type: "created",
          from_status: null,
          to_status: "draft",
          metadata: null,
          created_at: "2026-11-01T10:00:00.000Z",
        },
      ],
    });
    expect(orderService.createOrder).toHaveBeenCalledWith(
      { notes: "Entregar por la tarde" },
      expect.objectContaining({ role: "customer" }),
    );
  });

  it("lets a seller create an assisted order with customer_id", async () => {
    orderService.createOrder.mockResolvedValue(orderSnapshot());

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${tokenFor("seller")}`)
      .send({ customer_id: 8, items: ITEMS });

    expect(response.status).toBe(201);
    expect(orderService.createOrder).toHaveBeenCalledWith(
      { customer_id: 8, items: ITEMS },
      expect.objectContaining({ role: "seller" }),
    );
  });

  it("forwards the controlled service errors", async () => {
    orderService.createOrder.mockRejectedValue({
      status: 400,
      body: { message: "customer_id is required" },
    });

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${tokenFor("seller")}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "customer_id is required" });
  });
});
