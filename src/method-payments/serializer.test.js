const { toPublicMethodPayment } = require("./serializer");

const METHOD = {
  id: 1,
  method_payment_type_id: 3,
  label: "Banesco cuenta principal",
  details: {
    bank_name: "Banesco",
    account_number: "01340000000000000000",
  },
  is_active: true,
  method_payment_type: {
    id: 3,
    code: "BANK",
    name: "Banco Nacional",
    currency_id: 1,
    currency: {
      id: 1,
      code: "VES",
      name: "Bolívar",
      symbol: "Bs",
    },
  },
  createdAt: new Date("2026-10-29T12:00:00.000Z"),
  updatedAt: new Date("2026-10-29T12:00:00.000Z"),
};

describe("toPublicMethodPayment", () => {
  it("serializes the documented fields with the inherited currency", () => {
    expect(toPublicMethodPayment(METHOD)).toEqual({
      id: 1,
      method_payment_type_id: 3,
      label: "Banesco cuenta principal",
      details: {
        bank_name: "Banesco",
        account_number: "01340000000000000000",
      },
      is_active: true,
      currency_id: 1,
      currency: {
        id: 1,
        code: "VES",
        name: "Bolívar",
        symbol: "Bs",
      },
      method_payment_type: {
        id: 3,
        code: "BANK",
        name: "Banco Nacional",
      },
    });
  });

  it("never exposes audit columns and keeps the documented key order", () => {
    const result = toPublicMethodPayment(METHOD);

    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(Object.keys(result)).toEqual([
      "id",
      "method_payment_type_id",
      "label",
      "details",
      "is_active",
      "currency_id",
      "currency",
      "method_payment_type",
    ]);
  });

  it("copies details instead of exposing the stored object", () => {
    const result = toPublicMethodPayment(METHOD);

    expect(result.details).not.toBe(METHOD.details);
    expect(result.details).toEqual(METHOD.details);
  });

  it("returns empty details and null relations when they are missing", () => {
    expect(
      toPublicMethodPayment({
        id: 2,
        method_payment_type_id: 4,
        label: "Pelado",
        details: null,
        is_active: false,
      }),
    ).toEqual({
      id: 2,
      method_payment_type_id: 4,
      label: "Pelado",
      details: {},
      is_active: false,
      currency_id: null,
      currency: null,
      method_payment_type: null,
    });
  });

  it("uses the get() accessors of a Sequelize instance", () => {
    const method = { get: jest.fn((field) => METHOD[field]) };

    expect(toPublicMethodPayment(method)).toMatchObject({
      id: 1,
      currency_id: 1,
      method_payment_type: { id: 3, code: "BANK", name: "Banco Nacional" },
    });
    expect(method.get).toHaveBeenCalledWith("method_payment_type");
  });
});
