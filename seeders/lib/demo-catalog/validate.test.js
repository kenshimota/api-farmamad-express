const { validateFixture, validateProduct } = require("./validate");

function product(overrides = {}) {
  const externalId = overrides.external_id ?? "123456";

  return {
    external_id: externalId,
    name: `Producto ${externalId}`,
    description: "Descripción del producto",
    reference: `FARMATODO-${externalId}`,
    category: "Medicamentos",
    tax_code: "IVA",
    cost: 4.5,
    image: {
      original: `${externalId}.webp`,
      thumbnail: `${externalId}-thumb.webp`,
      reference: `demo-farmatodo-${externalId}`,
    },
    source_url: `https://www.farmatodo.com.ve/producto/${externalId}`,
    fetched_at: "2026-11-02T12:00:00.000Z",
    ...overrides,
  };
}

function fixture(count = 100) {
  return {
    products: Array.from({ length: count }, (_, index) =>
      product({ external_id: String(100000 + index) }),
    ),
  };
}

describe("demo fixture validation", () => {
  it("accepts a valid fixture and defaults a missing tax code to IVA", () => {
    const { products } = validateFixture(fixture(100));

    expect(products).toHaveLength(100);
    expect(products[0]).toEqual(
      expect.objectContaining({ tax_code: "IVA", cost: 4.5 }),
    );
  });

  it("accepts SIN_IVA as tax code", () => {
    const value = product({ tax_code: "SIN_IVA" });

    expect(validateProduct(value)).toEqual(
      expect.objectContaining({ tax_code: "SIN_IVA" }),
    );
  });

  it.each([
    ["external_id", { external_id: "" }],
    ["name", { name: "  " }],
    ["reference", { reference: "" }],
    ["image", { image: null }],
  ])("rejects a product without %s", (_field, overrides) => {
    expect(() => validateProduct(product(overrides))).toThrow(
      /external_id|name|reference|image/i,
    );
  });

  it("rejects duplicate references inside the fixture", () => {
    const data = fixture(100);
    data.products[1].reference = data.products[0].reference;

    expect(() => validateFixture(data)).toThrow(/duplicate reference/i);
  });

  it("rejects duplicate external ids inside the fixture", () => {
    const data = fixture(100);
    data.products[1].external_id = data.products[0].external_id;

    expect(() => validateFixture(data)).toThrow(/duplicate external_id/i);
  });

  it("rejects an unsupported tax code", () => {
    expect(() => validateProduct(product({ tax_code: "IGTF" }))).toThrow(
      /tax_code/,
    );
  });

  it.each([-1, "1.234", Number.NaN])("rejects an invalid cost %p", (cost) => {
    expect(() => validateProduct(product({ cost }))).toThrow(/cost/);
  });

  it("requires at least 100 products", () => {
    expect(() => validateFixture({ products: fixture(99).products })).toThrow(
      /at least 100 products/,
    );
  });

  it("rejects a fixture without a products array", () => {
    expect(() => validateFixture({})).toThrow(/products array/);
  });
});
