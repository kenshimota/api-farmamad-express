const { toPublicPaymentTerm } = require("./serializer");

describe("toPublicPaymentTerm", () => {
  it("exposes only the documented public fields", () => {
    const term = {
      id: 2,
      code: "credit_10",
      name: "Crédito 10 días",
      description: "Diez días",
      days: 10,
      is_active: true,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    };

    expect(toPublicPaymentTerm(term)).toEqual({
      id: 2,
      code: "credit_10",
      name: "Crédito 10 días",
      description: "Diez días",
      days: 10,
      is_active: true,
    });
  });

  it("accepts a Sequelize-like instance and null description", () => {
    const term = {
      get: (field) =>
        ({
          id: 1,
          code: "cash",
          name: "Contado",
          description: null,
          days: 0,
          is_active: true,
        })[field],
    };

    expect(toPublicPaymentTerm(term)).toEqual({
      id: 1,
      code: "cash",
      name: "Contado",
      description: null,
      days: 0,
      is_active: true,
    });
  });
});
