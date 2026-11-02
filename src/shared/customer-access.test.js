jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const User = require("../models/user");
const {
  isStaff,
  loadCurrentUser,
  ownsCustomer,
  resolveCustomerScope,
} = require("./customer-access");

/**
 * Builds a request double for middleware tests.
 * @param {object} [options] - Request options.
 * @returns {object} Express request double.
 */
function requestDouble({ sub = 1 } = {}) {
  return { user: { sub } };
}

/**
 * Builds a response double.
 * @returns {object} Express response double.
 */
function responseDouble() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("customer access helpers", () => {
  it("detects staff users", () => {
    expect(isStaff({ role: { name: "admin" } })).toBe(true);
    expect(isStaff({ role: "seller" })).toBe(true);
    expect(isStaff({ role: "customer" })).toBe(false);
    expect(isStaff(null)).toBe(false);
  });

  it("resolves the customer scope for staff", () => {
    expect(resolveCustomerScope({ role: { name: "seller" } }, 8)).toEqual({
      customerId: 8,
    });
    expect(resolveCustomerScope({ role: { name: "admin" } }, null)).toEqual({
      status: 400,
      body: { message: "customer_id is required" },
    });
  });

  it("always scopes a customer to its own profile", () => {
    const customer = { role: { name: "customer" }, customer_id: 8 };

    expect(resolveCustomerScope(customer, null)).toEqual({ customerId: 8 });
    expect(resolveCustomerScope(customer, 8)).toEqual({ customerId: 8 });
    expect(resolveCustomerScope(customer, 9)).toEqual({
      status: 403,
      body: { message: "Forbidden" },
    });
  });

  it("rejects a customer without a linked profile", () => {
    expect(
      resolveCustomerScope(
        { role: { name: "customer" }, customer_id: null },
        null,
      ),
    ).toEqual({
      status: 403,
      body: { message: "Customer profile is not linked" },
    });
  });

  it("checks ownership", () => {
    const customer = { role: { name: "customer" }, customer_id: 8 };

    expect(ownsCustomer(customer, 8)).toBe(true);
    expect(ownsCustomer(customer, 9)).toBe(false);
    expect(ownsCustomer({ ...customer, customer_id: null }, 8)).toBe(false);
  });

  it("loads the current user row", async () => {
    User.findByPk.mockResolvedValue({ id: 1, isBlocked: false });
    const req = requestDouble();
    const res = responseDouble();
    const next = jest.fn();

    await loadCurrentUser(req, res, next);

    expect(req.currentUser).toEqual({ id: 1, isBlocked: false });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("answers 401 for a missing user and 403 for a blocked one", async () => {
    const next = jest.fn();
    const res = responseDouble();

    User.findByPk.mockResolvedValue(null);
    await loadCurrentUser(requestDouble(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);

    User.findByPk.mockResolvedValue({ id: 1, isBlocked: true });
    await loadCurrentUser(requestDouble(), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "User is blocked" });
  });

  it("forwards unexpected errors", async () => {
    const error = new Error("db down");
    const next = jest.fn();
    User.findByPk.mockRejectedValue(error);

    await loadCurrentUser(requestDouble(), responseDouble(), next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
