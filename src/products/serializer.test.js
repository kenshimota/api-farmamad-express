const { toPublicProduct } = require("./serializer");

const PRODUCT = {
  id: 1,
  name: "Ibuprofeno 400 mg",
  description: "Analgésico y antiinflamatorio",
  reference: "IBU-400",
  category_id: 2,
  image_id: 3,
};

describe("toPublicProduct", () => {
  it("reads the fields directly from a plain object", () => {
    expect(toPublicProduct(PRODUCT)).toEqual(PRODUCT);
  });

  it("prefers the get() accessor over direct properties", () => {
    const values = {
      ...PRODUCT,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    const product = {
      get: jest.fn((field) => values[field]),
      id: 999,
      name: "Wrong",
    };

    expect(toPublicProduct(product)).toEqual(PRODUCT);
    expect(product.get).toHaveBeenCalledWith("id");
  });

  it("exposes only the six public fields in order", () => {
    expect(Object.keys(toPublicProduct(PRODUCT))).toEqual([
      "id",
      "name",
      "description",
      "reference",
      "category_id",
      "image_id",
    ]);
  });
});
