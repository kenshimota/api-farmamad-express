jest.mock("../models/customer", () => ({ findByPk: jest.fn() }));

const { UniqueConstraintError } = require("sequelize");
const Customer = require("../models/customer");
const { handleWriteError, loadCustomer } = require("./shared");

/**
 * Builds a minimal Express response double that records the status and body.
 * @returns {object} Response double with status and json spies.
 */
function response() {
  return {
    statusCode: 200,
    body: undefined,
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(body) {
      this.body = body;
      return this;
    }),
  };
}

beforeEach(() => {
  Customer.findByPk.mockReset();
});

describe("loadCustomer", () => {
  it("answers 422 when the id is not a positive integer", async () => {
    const res = response();
    const next = jest.fn();

    await loadCustomer({ params: { id: "abc" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { id: "Invalid customer id" } });
    expect(Customer.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 404 when the customer does not exist", async () => {
    Customer.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await loadCustomer({ params: { id: "999" } }, res, next);

    expect(Customer.findByPk).toHaveBeenCalledWith(999);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "Customer not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("exposes the customer and continues when it exists", async () => {
    const customer = { id: 1, fullName: "Juan Pérez" };
    Customer.findByPk.mockResolvedValue(customer);
    const req = { params: { id: "1" } };
    const res = response();
    const next = jest.fn();

    await loadCustomer(req, res, next);

    expect(Customer.findByPk).toHaveBeenCalledWith(1);
    expect(req.customer).toBe(customer);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("handleWriteError", () => {
  it("answers 409 when the email is duplicated", () => {
    const res = response();

    const result = handleWriteError(new UniqueConstraintError({}), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Customer already exists" });
    expect(result).toBe(res);
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");
    const res = response();

    expect(() => handleWriteError(error, res)).toThrow(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
