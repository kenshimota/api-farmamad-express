const { toPublicMethodPaymentType } = require("./serializer");

const FIELD = Object.freeze({
  key: "email",
  label: "Correo de PayPal",
  type: "email",
  required: true,
});

const TYPE = Object.freeze({
  id: 1,
  code: "PAYPAL",
  name: "PayPal",
  currency_id: 3,
  currency: {
    id: 3,
    code: "USD_BCV",
    name: "Dólar BCV",
    symbol: "$",
  },
  fields: [FIELD],
  description: "Pagos por PayPal",
  is_active: true,
  createdAt: new Date("2026-10-29T12:00:00.000Z"),
  updatedAt: new Date("2026-10-29T12:00:00.000Z"),
});

describe("toPublicMethodPaymentType", () => {
  it("serializes the documented fields with the nested currency", () => {
    expect(toPublicMethodPaymentType(TYPE)).toEqual({
      id: 1,
      code: "PAYPAL",
      name: "PayPal",
      currency_id: 3,
      currency: {
        id: 3,
        code: "USD_BCV",
        name: "Dólar BCV",
        symbol: "$",
      },
      fields: [FIELD],
      description: "Pagos por PayPal",
      is_active: true,
    });
  });

  it("never exposes audit columns and keeps the documented key order", () => {
    const result = toPublicMethodPaymentType(TYPE);

    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(Object.keys(result)).toEqual([
      "id",
      "code",
      "name",
      "currency_id",
      "currency",
      "fields",
      "description",
      "is_active",
    ]);
  });

  it("returns null currency and an empty field list when missing", () => {
    expect(
      toPublicMethodPaymentType({
        ...TYPE,
        currency: null,
        fields: null,
        description: null,
      }),
    ).toMatchObject({
      currency: null,
      fields: [],
      description: null,
    });
  });

  it("uses the get() accessors of a Sequelize instance", () => {
    const instance = { get: jest.fn((field) => TYPE[field]) };

    expect(toPublicMethodPaymentType(instance)).toEqual({
      id: 1,
      code: "PAYPAL",
      name: "PayPal",
      currency_id: 3,
      currency: {
        id: 3,
        code: "USD_BCV",
        name: "Dólar BCV",
        symbol: "$",
      },
      fields: [FIELD],
      description: "Pagos por PayPal",
      is_active: true,
    });
    expect(instance.get).toHaveBeenCalledWith("currency");
  });
});
