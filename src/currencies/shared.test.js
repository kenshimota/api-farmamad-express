jest.mock("../models/currency", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/currency-rate-history", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const Currency = require("../models/currency");
const { loadActiveCurrency, loadCurrency } = require("./shared");

/**
 * Builds a minimal Express response double.
 * @returns {object} Response double.
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
  Currency.findByPk.mockReset();
});

describe("loadCurrency", () => {
  it("answers 422 when the id is not a positive integer", async () => {
    const res = response();
    const next = jest.fn();

    await loadCurrency({ params: { id: "abc" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { id: "Invalid currency id" } });
    expect(Currency.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 404 when the currency does not exist", async () => {
    Currency.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await loadCurrency({ params: { id: "999" } }, res, next);

    expect(Currency.findByPk).toHaveBeenCalledWith(999, {
      transaction: undefined,
      lock: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "Currency not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("exposes the currency and continues when it exists", async () => {
    const currency = { id: 1 };
    Currency.findByPk.mockResolvedValue(currency);
    const req = { params: { id: "1" } };
    const res = response();
    const next = jest.fn();

    await loadCurrency(req, res, next);

    expect(req.currency).toBe(currency);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("loadActiveCurrency", () => {
  it("answers 404 when the currency is inactive", async () => {
    Currency.findByPk.mockResolvedValue({ id: 1, is_active: false });
    const res = response();
    const next = jest.fn();

    await loadActiveCurrency({ params: { id: "1" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "Currency not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("continues when the currency is active", async () => {
    const currency = { id: 1, is_active: true };
    Currency.findByPk.mockResolvedValue(currency);
    const req = { params: { id: "1" } };
    const res = response();
    const next = jest.fn();

    await loadActiveCurrency(req, res, next);

    expect(req.currency).toBe(currency);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
