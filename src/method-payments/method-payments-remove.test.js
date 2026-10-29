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

const { ForeignKeyConstraintError } = require("sequelize");
const MethodPayment = require("../models/method-payment");
const MethodPaymentType = require("../models/method-payment-type");
const User = require("../models/user");
const {
  AUTH_USER,
  TYPE,
  call,
  target,
  tokenFor,
} = require("../../test/helpers/method-payments-unit-support");

beforeEach(() => {
  MethodPayment.create.mockReset();
  MethodPayment.findAll.mockReset();
  MethodPayment.findByPk.mockReset();
  MethodPaymentType.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
  MethodPaymentType.findByPk.mockResolvedValue(TYPE);
});

describe("DELETE /method-payments/:id", () => {
  it("removes the method and answers 204", async () => {
    const method = target();
    MethodPayment.findByPk.mockResolvedValue(method);

    const response = await call("delete", "/method-payments/1");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(method.destroy).toHaveBeenCalledTimes(1);
  });

  it("responds 409 when a foreign key blocks the delete", async () => {
    const method = target();
    method.destroy.mockRejectedValue(
      new ForeignKeyConstraintError({ message: "foreign key" }),
    );
    MethodPayment.findByPk.mockResolvedValue(method);

    const response = await call("delete", "/method-payments/1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment method is in use" });
  });

  it("responds 404 for an unknown method", async () => {
    MethodPayment.findByPk.mockResolvedValue(null);

    const response = await call("delete", "/method-payments/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Payment method not found" });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call(
      "delete",
      "/method-payments/1",
      undefined,
      null,
    );
    expect(anonymous.status).toBe(401);

    const seller = await call(
      "delete",
      "/method-payments/1",
      undefined,
      tokenFor("seller"),
    );
    expect(seller.status).toBe(403);
    expect(seller.body).toEqual({ message: "Forbidden" });
    expect(MethodPayment.findByPk).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    const method = target();
    method.destroy.mockRejectedValue(new Error("database exploded"));
    MethodPayment.findByPk.mockResolvedValue(method);

    const response = await call("delete", "/method-payments/1");

    expect(response.status).toBe(500);
  });
});
