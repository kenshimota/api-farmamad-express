process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("./service", () => ({
  orderService: { createOrder: jest.fn() },
}));
jest.mock("./picking-repository", () => ({
  pickingRepository: { findOrderById: jest.fn() },
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { pickingRepository } = require("./picking-repository");
const { toPickingResponse } = require("./picking-serializer");
const { pickingOrder } = require("../../test/helpers/picking");
const router = require("./index");

const app = express();
app.use(express.json());
app.use("/orders", router);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Internal server error" });
});

const SECRET = "test-secret";

/**
 * Signs a JWT for the given role.
 * @param {string} [role] - Role embedded in the token.
 * @returns {string} Signed JWT.
 */
function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "ana", role }, SECRET, {
    expiresIn: "1h",
  });
}

beforeEach(() => {
  pickingRepository.findOrderById.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue({ id: 1, isBlocked: false });
});

describe("GET /orders/:id/picking", () => {
  it("responds 401 without a token", async () => {
    const response = await request(app).get("/orders/10/picking");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(pickingRepository.findOrderById).not.toHaveBeenCalled();
  });

  it.each(["customer", "support"])(
    "responds 403 when the role is %s",
    async (role) => {
      const response = await request(app)
        .get("/orders/10/picking")
        .set("Authorization", `Bearer ${tokenFor(role)}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(pickingRepository.findOrderById).not.toHaveBeenCalled();
    },
  );

  it.each(["admin", "seller", "manager_warehouse", "dispatcher"])(
    "lets the %s role read the picking list",
    async (role) => {
      pickingRepository.findOrderById.mockResolvedValue(pickingOrder());

      const response = await request(app)
        .get("/orders/10/picking")
        .set("Authorization", `Bearer ${tokenFor(role)}`);

      expect(response.status).toBe(200);
      expect(response.body.order).toMatchObject({ id: 10 });
      expect(pickingRepository.findOrderById).toHaveBeenCalledWith(10, {
        allocationStatus: undefined,
      });
    },
  );

  it("validates the order id before querying", async () => {
    for (const id of ["abc", "0", "-1", "1.5"]) {
      const response = await request(app)
        .get(`/orders/${id}/picking`)
        .set("Authorization", `Bearer ${tokenFor("admin")}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors: { id: "Invalid order id" } });
    }

    expect(pickingRepository.findOrderById).not.toHaveBeenCalled();
  });

  it("validates the allocation_status filter", async () => {
    const response = await request(app)
      .get("/orders/10/picking?allocation_status=pending")
      .set("Authorization", `Bearer ${tokenFor("admin")}`);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { allocation_status: "Invalid allocation_status" },
    });
    expect(pickingRepository.findOrderById).not.toHaveBeenCalled();
  });

  it("forwards a valid allocation_status filter", async () => {
    pickingRepository.findOrderById.mockResolvedValue(pickingOrder());

    const response = await request(app)
      .get("/orders/10/picking?allocation_status=all")
      .set("Authorization", `Bearer ${tokenFor("dispatcher")}`);

    expect(response.status).toBe(200);
    expect(pickingRepository.findOrderById).toHaveBeenCalledWith(10, {
      allocationStatus: "all",
    });
  });

  it("responds 404 when the order does not exist", async () => {
    pickingRepository.findOrderById.mockResolvedValue(null);

    const response = await request(app)
      .get("/orders/999/picking")
      .set("Authorization", `Bearer ${tokenFor("admin")}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Order not found" });
  });

  it("returns the order, customer, summary and FEFO items", async () => {
    const order = pickingOrder();
    pickingRepository.findOrderById.mockResolvedValue(order);

    const response = await request(app)
      .get("/orders/10/picking")
      .set("Authorization", `Bearer ${tokenFor("manager_warehouse")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(toPickingResponse(order));
    expect(response.body.items.map((item) => item.order_item_id)).toEqual([
      20, 21,
    ]);
    expect(
      response.body.items[0].lots.map(
        (allocation) => allocation.lot.expiration_date,
      ),
    ).toEqual(["2027-03-31", "2027-06-30"]);
    expect(response.body.summary).toEqual({
      lines_count: 2,
      lots_count: 3,
      ordered_units: 30,
      allocated_units: 30,
      pending_units: 0,
      ready: true,
    });
  });
});
