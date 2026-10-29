const { readField, toPublicLot, toPublicRelation } = require("./serializer");

/**
 * Builds a plain lot with the documented relations.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The lot double.
 */
function lotFixture(overrides = {}) {
  return {
    id: 1,
    number: "L-1",
    product_id: 15,
    expiration_date: "2027-03-31",
    item_state_id: 1,
    stock: 120,
    reserved: 15,
    warehouse_id: 1,
    shelf_id: 1,
    section_id: 2,
    product: { id: 15, name: "Ibuprofeno", reference: "IBU", extra: "x" },
    item_state: {
      id: 1,
      name: "sellable",
      label: "Vendible",
      is_sellable: true,
      description: "hidden",
    },
    warehouse: { id: 1, name: "Bodega", address: "hidden" },
    shelf: { id: 1, code: "A1", name: "Estante", description: "hidden" },
    section: { id: 2, code: "A1-02", name: "Nivel", shelf_id: 1 },
    ...overrides,
  };
}

describe("lot serializer", () => {
  it("returns the public lot with available and only documented nested fields", () => {
    const result = toPublicLot(lotFixture());

    expect(result).toEqual({
      id: 1,
      number: "L-1",
      product_id: 15,
      expiration_date: "2027-03-31",
      item_state_id: 1,
      stock: 120,
      reserved: 15,
      available: 105,
      warehouse_id: 1,
      shelf_id: 1,
      section_id: 2,
      product: { id: 15, name: "Ibuprofeno", reference: "IBU" },
      item_state: {
        id: 1,
        name: "sellable",
        label: "Vendible",
        is_sellable: true,
      },
      warehouse: { id: 1, name: "Bodega" },
      shelf: { id: 1, code: "A1", name: "Estante" },
      section: { id: 2, code: "A1-02", name: "Nivel" },
    });
  });

  it("returns null for missing relations and zero for missing quantities", () => {
    const result = toPublicLot(
      lotFixture({
        stock: undefined,
        reserved: undefined,
        product: null,
        item_state: undefined,
      }),
    );

    expect(result.stock).toBe(0);
    expect(result.reserved).toBe(0);
    expect(result.available).toBe(0);
    expect(result.product).toBeNull();
    expect(result.item_state).toBeNull();
    expect(toPublicRelation(null, ["id"])).toBeNull();
  });

  it("reads fields from Sequelize-like instances", () => {
    const values = lotFixture();
    const instance = {
      get: jest.fn((field) => values[field]),
    };

    expect(readField(instance, "number")).toBe("L-1");
    expect(toPublicLot(instance).id).toBe(1);
    expect(instance.get).toHaveBeenCalledWith("number");
  });
});
