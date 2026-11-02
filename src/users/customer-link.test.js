process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../models/role", () => ({ findByPk: jest.fn() }));
jest.mock("../models/customer", () => ({ findByPk: jest.fn() }));
jest.mock("../database", () => ({ transaction: jest.fn() }));

const User = require("../models/user");
const Customer = require("../models/customer");
const sequelize = require("../database");
const {
  CUSTOMER,
  PUBLIC_CUSTOMER,
  TRANSACTION,
  mockLookup,
  put,
  resetMocks,
  target,
} = require("../../test/helpers/customer-link-unit");

beforeEach(resetMocks);

describe("PUT /users/:id/customer", () => {
  it("links a customer user and answers 202 with the public customer", async () => {
    const user = target();
    mockLookup(user);
    Customer.findByPk.mockResolvedValue(CUSTOMER);
    User.findOne.mockResolvedValue(null);

    const response = await put(2, { customer_id: 8 });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      id: 2,
      username: "cliente",
      email: "cliente@example.com",
      name: "Cliente Demo",
      role: "customer",
      isBlocked: false,
      customer_id: 8,
      customer: PUBLIC_CUSTOMER,
    });
    expect(response.body.customer).not.toHaveProperty("isRegistered");
    expect(response.body.customer).not.toHaveProperty("createdAt");
    expect(user.update).toHaveBeenCalledWith(
      { customer_id: 8 },
      { transaction: TRANSACTION },
    );
    expect(User.findByPk).toHaveBeenCalledWith(2, {
      transaction: TRANSACTION,
      lock: TRANSACTION.LOCK.UPDATE,
    });
  });

  it("is idempotent when the same customer is sent again", async () => {
    const user = target({ customer_id: 8 });
    mockLookup(user);
    Customer.findByPk.mockResolvedValue(CUSTOMER);
    User.findOne.mockResolvedValue(user);

    const response = await put(2, { customer_id: 8 });

    expect(response.status).toBe(202);
    expect(response.body.customer_id).toBe(8);
    expect(response.body.customer).toEqual(PUBLIC_CUSTOMER);
    expect(user.update).not.toHaveBeenCalled();
  });

  it("replaces the linked customer", async () => {
    const user = target({ customer_id: 8 });
    mockLookup(user);
    Customer.findByPk.mockResolvedValue({ ...CUSTOMER, id: 9 });
    User.findOne.mockResolvedValue(null);

    const response = await put(2, { customer_id: 9 });

    expect(response.status).toBe(202);
    expect(response.body.customer_id).toBe(9);
    expect(user.update).toHaveBeenCalledWith(
      { customer_id: 9 },
      { transaction: TRANSACTION },
    );
  });

  it("unlinks the customer when customer_id is null", async () => {
    const user = target({ customer_id: 8, customer: CUSTOMER });
    mockLookup(user);

    const response = await put(2, { customer_id: null });

    expect(response.status).toBe(202);
    expect(response.body.customer_id).toBeNull();
    expect(response.body.customer).toBeNull();
    expect(user.update).toHaveBeenCalledWith(
      { customer_id: null },
      { transaction: TRANSACTION },
    );
    expect(Customer.findByPk).not.toHaveBeenCalled();
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it("responds 400 when customer_id is absent", async () => {
    const response = await put(2, {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "customer_id is required" });
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });
});
