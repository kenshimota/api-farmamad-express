const {
  toMoneyNumber,
  toPublicPurchase,
  toPublicPurchaseItem,
} = require("./serializer");

const ITEM = {
  id: 1,
  purchase_id: 1,
  product_id: 15,
  item_state_id: 1,
  quantity: 40,
  unit_cost: "20.00",
  subtotal: "800.00",
};
const PURCHASE = {
  id: 1,
  number: 1,
  supplier_id: 2,
  status: "draft",
  subtotal: "800.00",
  tax_rate: "16.00",
  tax_amount: "128.00",
  total: "928.00",
  notes: null,
  confirmed_at: null,
  items: [ITEM],
  supplier: {
    id: 2,
    name: "Distribuidora",
    identification: "J-1",
    email: "ventas@example.com",
    phone: "1234567",
    observations: null,
    address: "Calle 1",
    city_id: 1,
    state_id: 1,
  },
};
const { toPublicSupplier } = require("../suppliers/serializer");

describe("toMoneyNumber", () => {
  it.each([
    ["12.50", 12.5],
    [12.5, 12.5],
    [null, null],
    [undefined, null],
    ["", null],
    ["abc", null],
  ])("converts %p", (value, expected) => {
    expect(toMoneyNumber(value)).toBe(expected);
  });
});

describe("toPublicPurchaseItem", () => {
  it("exposes only the public line fields as numbers", () => {
    expect(toPublicPurchaseItem(ITEM)).toEqual({
      id: 1,
      product_id: 15,
      item_state_id: 1,
      quantity: 40,
      unit_cost: 20,
      subtotal: 800,
    });
  });
});

describe("toPublicPurchase", () => {
  it("returns the base fields without timestamps for a draft", () => {
    const result = toPublicPurchase(PURCHASE);

    expect(result).toEqual({
      id: 1,
      number: 1,
      supplier_id: 2,
      status: "draft",
      subtotal: 800,
      tax_rate: 16,
      tax_amount: 128,
      total: 928,
      notes: null,
    });
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(result).not.toHaveProperty("items");
    expect(result).not.toHaveProperty("supplier");
    expect(result).not.toHaveProperty("confirmed_at");
  });

  it("nests items and supplier and serializes confirmed_at", () => {
    const result = toPublicPurchase(
      {
        ...PURCHASE,
        status: "confirmed",
        confirmed_at: new Date("2026-10-29T10:00:00.000Z"),
      },
      { includeItems: true, includeSupplier: true },
    );

    expect(result.confirmed_at).toBe("2026-10-29T10:00:00.000Z");
    expect(result.items).toEqual([
      {
        id: 1,
        product_id: 15,
        item_state_id: 1,
        quantity: 40,
        unit_cost: 20,
        subtotal: 800,
      },
    ]);
    expect(result.supplier).toEqual(toPublicSupplier(PURCHASE.supplier));
  });

  it("keeps a string confirmed_at and ignores missing nested data", () => {
    const result = toPublicPurchase(
      { ...PURCHASE, confirmed_at: "2026-10-29T10:00:00.000Z" },
      { includeItems: true, includeSupplier: true },
    );

    expect(result.confirmed_at).toBe("2026-10-29T10:00:00.000Z");
    expect(result.items).toHaveLength(1);
  });
});
