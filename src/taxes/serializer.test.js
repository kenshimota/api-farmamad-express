const { toPublicTax } = require("./serializer");

const TAX = {
  id: 1,
  code: "IVA",
  name: "Impuesto al Valor Agregado",
  rate: "16.00",
  description: "IVA general",
  is_active: true,
  createdAt: new Date("2026-10-29T12:00:00.000Z"),
  updatedAt: new Date("2026-10-29T12:00:00.000Z"),
};

describe("toPublicTax", () => {
  it("serializes the documented fields and converts rate to a number", () => {
    expect(toPublicTax(TAX)).toEqual({
      id: 1,
      code: "IVA",
      name: "Impuesto al Valor Agregado",
      rate: 16,
      description: "IVA general",
      is_active: true,
    });
  });

  it("never exposes audit columns and keeps the documented key order", () => {
    const result = toPublicTax(TAX);

    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(Object.keys(result)).toEqual([
      "id",
      "code",
      "name",
      "rate",
      "description",
      "is_active",
    ]);
  });

  it("rounds the rate to two decimals", () => {
    expect(toPublicTax({ ...TAX, rate: "3.50" }).rate).toBe(3.5);
    expect(toPublicTax({ ...TAX, rate: "3.555" }).rate).toBe(3.56);
  });

  it("returns null for an invalid rate and a null description", () => {
    expect(
      toPublicTax({ ...TAX, rate: null, description: null }),
    ).toMatchObject({ rate: null, description: null });
  });

  it("uses the get() accessors of a Sequelize instance", () => {
    const tax = { get: jest.fn((field) => TAX[field]) };

    expect(toPublicTax(tax)).toEqual({
      id: 1,
      code: "IVA",
      name: "Impuesto al Valor Agregado",
      rate: 16,
      description: "IVA general",
      is_active: true,
    });
    expect(tax.get).toHaveBeenCalledWith("rate");
  });
});
