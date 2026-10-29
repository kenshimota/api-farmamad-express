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

const { UniqueConstraintError } = require("sequelize");
const sequelize = require("../database");
const MethodPayment = require("../models/method-payment");
const MethodPaymentType = require("../models/method-payment-type");
const User = require("../models/user");
const {
  AUTH_USER,
  BODY,
  CURRENCY,
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

describe("POST /method-payments", () => {
  it("creates a method, normalizes details and answers 201", async () => {
    MethodPayment.create.mockResolvedValue({ id: 1 });
    MethodPayment.findByPk.mockResolvedValue(storedMethod());

    const response = await call("post", "/method-payments", {
      ...BODY,
      details: { email: "  pagos@farmamad.com  " },
      currency_id: 99,
      currency: { id: 99 },
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 1,
      method_payment_type_id: 1,
      label: "PayPal Farmamad",
      details: { email: "pagos@farmamad.com" },
      is_active: true,
      currency_id: 3,
      currency: {
        id: 3,
        code: "USD_BCV",
        name: "Dólar BCV",
        symbol: "$",
      },
      method_payment_type: { id: 1, code: "PAYPAL", name: "PayPal" },
    });
    expect(MethodPayment.create).toHaveBeenCalledWith(
      {
        method_payment_type_id: 1,
        label: "PayPal Farmamad",
        details: { email: "pagos@farmamad.com" },
        is_active: true,
      },
      { transaction: TRANSACTION },
    );
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body).not.toHaveProperty("updatedAt");
  });

  it("responds 400 when required fields are missing", async () => {
    const response = await call("post", "/method-payments", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "method_payment_type_id, label and details are required",
    });
    expect(MethodPayment.create).not.toHaveBeenCalled();
  });

  it("responds 422 when the type does not exist or is inactive", async () => {
    MethodPaymentType.findByPk.mockResolvedValue(null);

    const missing = await call("post", "/method-payments", BODY);
    expect(missing.status).toBe(422);
    expect(missing.body).toEqual({
      errors: { method_payment_type_id: "Invalid payment type" },
    });

    MethodPaymentType.findByPk.mockResolvedValue({
      ...TYPE,
      is_active: false,
    });
    const inactive = await call("post", "/method-payments", BODY);
    expect(inactive.status).toBe(422);
    expect(inactive.body).toEqual({
      errors: { method_payment_type_id: "Invalid payment type" },
    });
    expect(MethodPayment.create).not.toHaveBeenCalled();
  });

  it("responds 422 when the type currency is inactive", async () => {
    MethodPaymentType.findByPk.mockResolvedValue({
      ...TYPE,
      currency: { ...CURRENCY, is_active: false },
    });

    const response = await call("post", "/method-payments", BODY);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { method_payment_type_id: "Invalid payment type" },
    });
  });

  it("responds 422 with details field errors", async () => {
    const missing = await call("post", "/method-payments", {
      ...BODY,
      details: {},
    });
    expect(missing.status).toBe(422);
    expect(missing.body).toEqual({
      errors: { "details.email": "email is required" },
    });

    const unknown = await call("post", "/method-payments", {
      ...BODY,
      details: { email: "pagos@farmamad.com", cvv: "123" },
    });
    expect(unknown.status).toBe(422);
    expect(unknown.body).toEqual({
      errors: { "details.cvv": "Unknown field" },
    });
    expect(MethodPayment.create).not.toHaveBeenCalled();
  });

  it("responds 409 when the label already exists in the type", async () => {
    MethodPayment.create.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );

    const response = await call("post", "/method-payments", BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Payment method already exists",
    });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call("post", "/method-payments", BODY, null);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const seller = await call(
      "post",
      "/method-payments",
      BODY,
      tokenFor("seller"),
    );
    expect(seller.status).toBe(403);
    expect(seller.body).toEqual({ message: "Forbidden" });
    expect(MethodPayment.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    MethodPayment.create.mockRejectedValue(new Error("database exploded"));

    const response = await call("post", "/method-payments", BODY);

    expect(response.status).toBe(500);
  });
});
