const { UniqueConstraintError } = require("sequelize");
const {
  baseRateLocked,
  currencyNotFound,
  handleCurrencyError,
  invalidCurrencyId,
} = require("./errors");

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

describe("currency error factories", () => {
  it("builds the invalid id, not found and locked rate errors", () => {
    expect(invalidCurrencyId()).toMatchObject({
      status: 422,
      body: { errors: { id: "Invalid currency id" } },
    });
    expect(currencyNotFound()).toMatchObject({
      status: 404,
      body: { message: "Currency not found" },
    });
    expect(baseRateLocked()).toMatchObject({
      status: 409,
      body: { message: "Base currency rate cannot be changed" },
    });
  });
});

describe("handleCurrencyError", () => {
  it("serializes service errors with their status and body", () => {
    const res = response();

    handleCurrencyError(
      { status: 409, body: { message: "Base currency cannot be deactivated" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({
      message: "Base currency cannot be deactivated",
    });
  });

  it("answers 409 for a duplicated code", () => {
    const res = response();

    handleCurrencyError(
      new UniqueConstraintError({ message: "duplicate" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Currency already exists" });
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleCurrencyError(error, response())).toThrow(error);
  });
});
