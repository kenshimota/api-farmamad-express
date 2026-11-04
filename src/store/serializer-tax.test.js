const { toStoreDetailVariant, toStoreListVariant } = require("./serializer");

const CURRENCY = {
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
  rate: "1.000000",
  is_active: true,
};
const ITEM_STATE = { id: 1, name: "sellable", label: "Vendible" };
const PRODUCT = {
  id: 15,
  name: "Ibuprofeno 400 mg",
  description: "Analgésico y antiinflamatorio",
  reference: "IBU-400",
  category_id: 2,
  image_id: 7,
  category: null,
  image: null,
};
const TAX = { id: 2, code: "IVA", name: "IVA", rate: "16.00" };

describe("store tax serializer", () => {
  it("calculates the tax amount and final total of a listing variant", () => {
    const variant = toStoreListVariant({
      product: PRODUCT,
      itemState: ITEM_STATE,
      price: 14.29,
      tax: TAX,
      currency: CURRENCY,
      available: true,
    });

    expect(variant.tax).toEqual({
      id: 2,
      code: "IVA",
      name: "IVA",
      rate: 16,
    });
    expect(variant.tax_amount).toBe(2.29);
    expect(variant.total).toBe(16.58);
  });

  it("calculates the tax amount and final total of a detail variant", () => {
    const variant = toStoreDetailVariant({
      itemState: ITEM_STATE,
      price: 14.29,
      tax: TAX,
      currency: CURRENCY,
      available: true,
    });

    expect(variant.tax).toEqual({
      id: 2,
      code: "IVA",
      name: "IVA",
      rate: 16,
    });
    expect(variant.tax_amount).toBe(2.29);
    expect(variant.total).toBe(16.58);
  });

  it("leaves zero tax and keeps the price when the product has no tax", () => {
    const variant = toStoreDetailVariant({
      itemState: ITEM_STATE,
      price: 14.29,
      tax: null,
      currency: CURRENCY,
      available: true,
    });

    expect(variant.tax).toBeNull();
    expect(variant.tax_amount).toBe(0);
    expect(variant.total).toBe(14.29);
  });
});
