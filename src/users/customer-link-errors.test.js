process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../models/role", () => ({ findByPk: jest.fn() }));
jest.mock("../models/customer", () => ({ findByPk: jest.fn() }));
jest.mock("../database", () => ({ transaction: jest.fn() }));

const { UniqueConstraintError } = require("sequelize");
const User = require("../models/user");
const Customer = require("../models/customer");
const sequelize = require("../database");
const {
  CUSTOMER,
  mockLookup,
  put,
  resetMocks,
  target,
  tokenFor,
} = require("../../test/helpers/customer-link-unit");

beforeEach(resetMocks);

describe("PUT /users/:id/customer validation and errors", () => {
  it.each(["8", 1.5, 0, -1, true])(
    "responds 422 when customer_id is %p",
    async (value) => {
      const response = await put(2, { customer_id: value });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { customer_id: "Invalid customer id" },
      });
      expect(sequelize.transaction).not.toHaveBeenCalled();
    },
  );

  it("responds 422 when the route id is not a positive integer", async () => {
    const response = await put("abc", { customer_id: 8 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid user id" } });
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it("responds 404 when the user does not exist", async () => {
    mockLookup(null);

    const response = await put(999, { customer_id: 8 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "User not found" });
  });

  it("responds 422 when the user is not a customer", async () => {
    const user = target({ roleId: 3, roleName: "seller" });
    mockLookup(user);

    const response = await put(2, { customer_id: 8 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { customer_id: "User is not a customer" },
    });
    expect(Customer.findByPk).not.toHaveBeenCalled();
    expect(user.update).not.toHaveBeenCalled();
  });

  it("responds 422 when the customer does not exist", async () => {
    Customer.findByPk.mockResolvedValue(null);

    const response = await put(2, { customer_id: 8 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { customer_id: "Invalid customer" },
    });
  });

  it("responds 409 when the customer is linked to another user", async () => {
    const user = target();
    mockLookup(user);
    Customer.findByPk.mockResolvedValue(CUSTOMER);
    User.findOne.mockResolvedValue({ id: 99 });

    const response = await put(2, { customer_id: 8 });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Customer is already linked to a user",
    });
    expect(user.update).not.toHaveBeenCalled();
  });

  it("answers 409 when the unique link is taken during the update", async () => {
    const user = target();
    mockLookup(user);
    Customer.findByPk.mockResolvedValue(CUSTOMER);
    User.findOne.mockResolvedValue(null);
    user.update.mockRejectedValue(
      new UniqueConstraintError({ fields: { customer_id: 8 } }),
    );

    const response = await put(2, { customer_id: 8 });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Customer is already linked to a user",
    });
  });

  it("responds 401 without a token", async () => {
    const response = await put(2, { customer_id: 8 }, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it.each(["seller", "dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await put(2, { customer_id: 8 }, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(sequelize.transaction).not.toHaveBeenCalled();
    },
  );
});
