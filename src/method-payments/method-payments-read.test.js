process.env.JWT_SECRET = "test-secret";

jest.mock("../database", () => ({ transaction: jest.fn() }));
jest.mock("../models/method-payment", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/method-payment-type", () => ({
  findByPk: jest.fn(),
}));
jest.mock("../models/currency", () => ({
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const sequelize = require("../database");
const MethodPayment = require("../models/method-payment");
const MethodPaymentType = require("../models/method-payment-type");
const User = require("../models/user");
const {
  AUTH_USER,
  TRANSACTION,
  TYPE,
  call,
  storedMethod,
  tokenFor,
} = require("../../test/helpers/method-payments-unit-support");

beforeEach(() => {
  sequelize.transaction.mockReset();
  sequelize.transaction.mockImplementation((callback) => callback(TRANSACTION));
  MethodPayment.create.mockReset();
  MethodPayment.findAll.mockReset();
  MethodPayment.findByPk.mockReset();
  MethodPaymentType.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
  MethodPaymentType.findByPk.mockResolvedValue(TYPE);
});

describe("GET /method-payments", () => {
  it.each(["admin", "seller", "dispatcher"])(
    "allows a %s to list methods",
    async (role) => {
      MethodPayment.findAll.mockResolvedValue([storedMethod()]);

      const response = await call(
        "get",
        "/method-payments",
        undefined,
        tokenFor(role),
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        expect.objectContaining({
          id: 1,
          currency_id: 3,
          method_payment_type: { id: 1, code: "PAYPAL", name: "PayPal" },
        }),
      ]);
      expect(MethodPayment.findAll).toHaveBeenCalledWith({
        where: {},
        order: [
          ["method_payment_type_id", "ASC"],
          ["label", "ASC"],
        ],
        include: [expect.any(Object)],
      });
    },
  );

  it("applies the documented filters", async () => {
    MethodPayment.findAll.mockResolvedValue([]);

    const response = await call(
      "get",
      "/method-payments?method_payment_type_id=2&currency_id=3&is_active=false",
    );

    expect(response.status).toBe(200);
    const options = MethodPayment.findAll.mock.calls[0][0];
    expect(options.where).toEqual({
      method_payment_type_id: 2,
      is_active: false,
    });
    expect(options.include[0]).toMatchObject({
      as: "method_payment_type",
      required: true,
      where: { currency_id: 3 },
    });
  });

  it.each([
    ["method_payment_type_id=abc", "method_payment_type_id"],
    ["currency_id=abc", "currency_id"],
    ["is_active=maybe", "is_active"],
  ])("responds 422 for the filter %s", async (query, field) => {
    const response = await call("get", `/method-payments?${query}`);

    expect(response.status).toBe(422);
    expect(response.body.errors).toHaveProperty(field);
    expect(MethodPayment.findAll).not.toHaveBeenCalled();
  });

  it.each(["manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await call(
        "get",
        "/method-payments",
        undefined,
        tokenFor(role),
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 401 without a token", async () => {
    const response = await call("get", "/method-payments", undefined, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});

describe("GET /method-payments/:id", () => {
  it("returns the method detail", async () => {
    MethodPayment.findByPk.mockResolvedValue(storedMethod());

    const response = await call("get", "/method-payments/1");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 1,
      label: "PayPal Farmamad",
      currency_id: 3,
      method_payment_type: { id: 1, code: "PAYPAL", name: "PayPal" },
    });
  });

  it("responds 404 when the method does not exist", async () => {
    MethodPayment.findByPk.mockResolvedValue(null);

    const response = await call("get", "/method-payments/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Payment method not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await call("get", `/method-payments/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid payment method id" },
      });
      expect(MethodPayment.findByPk).not.toHaveBeenCalled();
    },
  );
});
