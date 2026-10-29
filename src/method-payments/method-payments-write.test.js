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
  CURRENCY,
  TRANSACTION,
  TYPE,
  call,
  target,
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

describe("PUT /method-payments/:id", () => {
  it("updates label, details and is_active and answers 202", async () => {
    const method = target();
    MethodPayment.findByPk.mockResolvedValueOnce(method).mockResolvedValueOnce(
      target({
        label: "PayPal principal",
        details: { email: "tesoreria@farmamad.com" },
      }),
    );

    const response = await call("put", "/method-payments/1", {
      label: "  PayPal principal  ",
      details: { email: "  tesoreria@farmamad.com  " },
      is_active: true,
    });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      id: 1,
      label: "PayPal principal",
      details: { email: "tesoreria@farmamad.com" },
      is_active: true,
      currency_id: 3,
    });
    expect(method.update).toHaveBeenCalledWith(
      {
        label: "PayPal principal",
        details: { email: "tesoreria@farmamad.com" },
        is_active: true,
      },
      { transaction: TRANSACTION },
    );
  });

  it("ignores currency_id and currency in the body", async () => {
    const method = target();
    MethodPayment.findByPk.mockResolvedValue(method);

    const response = await call("put", "/method-payments/1", {
      label: "PayPal principal",
      currency_id: 99,
      currency: { id: 99 },
    });

    expect(response.status).toBe(202);
    expect(method.update).toHaveBeenCalledWith(
      { label: "PayPal principal" },
      { transaction: TRANSACTION },
    );
  });

  it("responds 422 when method_payment_type_id changes", async () => {
    const method = target();
    MethodPayment.findByPk.mockResolvedValue(method);

    const response = await call("put", "/method-payments/1", {
      method_payment_type_id: 2,
      label: "PayPal principal",
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: {
        method_payment_type_id: "method_payment_type_id cannot be changed",
      },
    });
    expect(method.update).not.toHaveBeenCalled();
  });

  it("accepts the same method_payment_type_id", async () => {
    const method = target();
    MethodPayment.findByPk.mockResolvedValue(method);

    const response = await call("put", "/method-payments/1", {
      method_payment_type_id: 1,
      label: "PayPal principal",
    });

    expect(response.status).toBe(202);
    expect(method.update).toHaveBeenCalledWith(
      { label: "PayPal principal" },
      { transaction: TRANSACTION },
    );
  });

  it("responds 400 when no editable field is provided", async () => {
    const response = await call("put", "/method-payments/1", {
      currency_id: 3,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "At least one field is required",
    });
    expect(MethodPayment.findByPk).not.toHaveBeenCalled();
  });

  it("responds 422 with details field errors", async () => {
    const method = target();
    MethodPayment.findByPk.mockResolvedValue(method);

    const response = await call("put", "/method-payments/1", {
      details: {},
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { "details.email": "email is required" },
    });
    expect(method.update).not.toHaveBeenCalled();
  });

  it("rejects reactivating when the type is inactive", async () => {
    const method = target({ is_active: false });
    MethodPayment.findByPk.mockResolvedValue(method);
    MethodPaymentType.findByPk.mockResolvedValue({
      ...TYPE,
      is_active: false,
    });

    const response = await call("put", "/method-payments/1", {
      is_active: true,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { method_payment_type_id: "Invalid payment type" },
    });
    expect(method.update).not.toHaveBeenCalled();
  });

  it("allows deactivating an active method whose type is inactive", async () => {
    const method = target();
    MethodPayment.findByPk.mockResolvedValue(method);
    MethodPaymentType.findByPk.mockResolvedValue({
      ...TYPE,
      is_active: false,
      currency: { ...CURRENCY, is_active: false },
    });

    const response = await call("put", "/method-payments/1", {
      is_active: false,
    });

    expect(response.status).toBe(202);
    expect(method.update).toHaveBeenCalledWith(
      { is_active: false },
      { transaction: TRANSACTION },
    );
  });

  it("responds 409 when the label already exists in the type", async () => {
    const method = target();
    method.update.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );
    MethodPayment.findByPk.mockResolvedValue(method);

    const response = await call("put", "/method-payments/1", {
      label: "PayPal principal",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Payment method already exists",
    });
  });

  it("responds 404 for an unknown method", async () => {
    MethodPayment.findByPk.mockResolvedValue(null);

    const response = await call("put", "/method-payments/999", {
      label: "PayPal",
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Payment method not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await call("put", `/method-payments/${id}`, {
        label: "PayPal",
      });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid payment method id" },
      });
      expect(MethodPayment.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call(
      "put",
      "/method-payments/1",
      { label: "PayPal" },
      null,
    );
    expect(anonymous.status).toBe(401);

    const seller = await call(
      "put",
      "/method-payments/1",
      { label: "PayPal" },
      tokenFor("seller"),
    );
    expect(seller.status).toBe(403);
    expect(seller.body).toEqual({ message: "Forbidden" });
    expect(MethodPayment.findByPk).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    const method = target();
    method.update.mockRejectedValue(new Error("database exploded"));
    MethodPayment.findByPk.mockResolvedValue(method);

    const response = await call("put", "/method-payments/1", {
      label: "PayPal",
    });

    expect(response.status).toBe(500);
  });
});
