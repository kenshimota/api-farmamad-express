process.env.JWT_SECRET = "test-secret";

jest.mock("./service", () => ({
  orderService: { createOrder: jest.fn() },
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

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
 * Builds the expected serialized order returned by the service double.
 * @returns {object} The order snapshot.
 */
function orderSnapshot() {
  return {
    id: 10,
    number: 1,
    status: "pending",
    customer_id: 8,
    user_id: 12,
    currency_id: 3,
    subtotal: "28.58",
    total: "28.58",
    delivery_address: "Av. Monseñor Rivero 123",
    notes: null,
    createdAt: new Date("2026-10-30T15:00:00.000Z"),
    currency: { id: 3, code: "USD_BCV", name: "Dólar BCV", symbol: "$" },
    customer: {
      id: 8,
      fullName: "Cliente Demo",
      email: "cliente@example.com",
      direction: "Av. Monseñor Rivero 123",
    },
    items: [
      {
        id: 20,
        product_id: 15,
        item_state_id: 1,
        quantity: 2,
        unit_price: "14.29",
        subtotal: "28.58",
        product: { id: 15, name: "Ibuprofeno", reference: "IBU", image_id: 1 },
        item_state: { id: 1, name: "sellable", label: "Vendible" },
      },
    ],
    history: [
      {
        event_type: "created",
        from_status: null,
        to_status: "pending",
        createdAt: new Date("2026-10-30T15:00:00.000Z"),
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

  it("responds 403 for roles other than customer", async () => {
    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${tokenFor("admin")}`)
      .send({ items: ITEMS });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });

  it("responds 400 when items is missing", async () => {
    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ notes: "sin líneas" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "items is required" });
  });

  it("responds 422 for invalid quantities", async () => {
    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ items: [{ ...ITEMS[0], quantity: 0 }] });

    expect(response.status).toBe(422);
    expect(response.body.errors["items.0.quantity"]).toBeDefined();
  });

  it("creates the order and answers 201 with the public snapshot", async () => {
    orderService.createOrder.mockResolvedValue(orderSnapshot());

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({
        items: ITEMS,
        delivery_address: "  Av. Monseñor Rivero 123  ",
        customer_id: 999,
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 10,
      number: 1,
      status: "pending",
      customer_id: 8,
      user_id: 12,
      currency_id: 3,
      currency: { id: 3, code: "USD_BCV", name: "Dólar BCV", symbol: "$" },
      subtotal: 28.58,
      total: 28.58,
      delivery_address: "Av. Monseñor Rivero 123",
      notes: null,
      created_at: "2026-10-30T15:00:00.000Z",
      customer: {
        id: 8,
        fullName: "Cliente Demo",
        email: "cliente@example.com",
        direction: "Av. Monseñor Rivero 123",
      },
      items: [
        {
          id: 20,
          product_id: 15,
          item_state_id: 1,
          item_state: { id: 1, name: "sellable", label: "Vendible" },
          quantity: 2,
          unit_price: 14.29,
          subtotal: 28.58,
          product: {
            id: 15,
            name: "Ibuprofeno",
            reference: "IBU",
            image_id: 1,
          },
        },
      ],
      history: [
        {
          event_type: "created",
          from_status: null,
          to_status: "pending",
          created_at: "2026-10-30T15:00:00.000Z",
        },
      ],
    });
    expect(orderService.createOrder).toHaveBeenCalledWith(
      {
        items: ITEMS,
        delivery_address: "Av. Monseñor Rivero 123",
      },
      expect.objectContaining({ sub: 1, role: "customer" }),
    );
  });

  it("sends controlled service errors with their status and body", async () => {
    orderService.createOrder.mockRejectedValue(
      require("../shared/http-error").createHttpError(403, {
        message: "Customer profile is not linked",
      }),
    );

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ items: ITEMS });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: "Customer profile is not linked",
    });
  });
});
