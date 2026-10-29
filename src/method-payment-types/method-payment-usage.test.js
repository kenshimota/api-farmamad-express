const {
  createMethodPaymentUsage,
  isMissingMethodPaymentModel,
  resolveMethodPaymentColumn,
} = require("./method-payment-usage");

/**
 * Builds a usage counter with an injected model loader.
 * @param {() => object|null} loader - Model loader.
 * @returns {{ countMethods: (id: number) => Promise<number> }} The counter.
 */
function usageFor(loader) {
  return createMethodPaymentUsage({ loader });
}

describe("method payment usage", () => {
  it("counts zero when the future model is absent", async () => {
    await expect(usageFor(() => null).countMethods(1)).resolves.toBe(0);
  });

  it("counts zero when the model declares no known foreign key", async () => {
    const model = {
      getAttributes: () => ({ id: {} }),
      count: jest.fn(),
    };

    await expect(usageFor(() => model).countMethods(1)).resolves.toBe(0);
    expect(model.count).not.toHaveBeenCalled();
  });

  it("counts by method_payment_type_id when declared", async () => {
    const model = {
      getAttributes: () => ({ method_payment_type_id: {} }),
      count: jest.fn().mockResolvedValue(4),
    };

    await expect(usageFor(() => model).countMethods(7)).resolves.toBe(4);
    expect(model.count).toHaveBeenCalledWith({
      where: { method_payment_type_id: 7 },
    });
  });

  it("falls back to rawAttributes when getAttributes is absent", async () => {
    const model = {
      rawAttributes: { type_id: {} },
      count: jest.fn().mockResolvedValue(2),
    };

    await expect(usageFor(() => model).countMethods(9)).resolves.toBe(2);
    expect(model.count).toHaveBeenCalledWith({ where: { type_id: 9 } });
  });

  it("resolves null when the model exposes no attributes", () => {
    expect(resolveMethodPaymentColumn({})).toBeNull();
    expect(
      resolveMethodPaymentColumn({ getAttributes: () => null }),
    ).toBeNull();
  });

  it("only treats the exact missing model path as absence", () => {
    expect(
      isMissingMethodPaymentModel({
        code: "MODULE_NOT_FOUND",
        message: "Cannot find module '../models/method-payment'",
      }),
    ).toBe(true);
    expect(
      isMissingMethodPaymentModel({
        code: "MODULE_NOT_FOUND",
        message: "Cannot find module 'pg'",
      }),
    ).toBe(false);
    expect(isMissingMethodPaymentModel(new Error("boom"))).toBe(false);
  });
});
