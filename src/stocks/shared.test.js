jest.mock("../models/stock", () => ({ findByPk: jest.fn() }));

const Stock = require("../models/stock");
const { loadStock } = require("./shared");

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
  Stock.findByPk.mockReset();
});

describe("loadStock", () => {
  it("answers 422 when the id is not a positive integer", async () => {
    const res = response();
    const next = jest.fn();

    await loadStock({ params: { id: "abc" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { id: "Invalid stock id" } });
    expect(Stock.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 404 when the stock does not exist", async () => {
    Stock.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await loadStock({ params: { id: "999" } }, res, next);

    expect(Stock.findByPk).toHaveBeenCalledWith(999, expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "Stock not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("exposes the stock and continues when it exists", async () => {
    const stock = { id: 1, quantity: 10 };
    Stock.findByPk.mockResolvedValue(stock);
    const req = { params: { id: "1" } };
    const res = response();
    const next = jest.fn();

    await loadStock(req, res, next);

    expect(Stock.findByPk).toHaveBeenCalledWith(1, expect.any(Object));
    expect(req.stock).toBe(stock);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
