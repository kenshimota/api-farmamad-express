const Purchase = require("./purchase");
const Supplier = require("./supplier");
const Currency = require("./currency");

describe("Purchase model", () => {
  it("defines the required currency column", () => {
    const attributes = Purchase.getAttributes();

    expect(attributes.currency_id.type.key).toBe("INTEGER");
    expect(attributes.currency_id.allowNull).toBe(false);
  });

  it("belongs to Supplier and Currency", () => {
    expect(Purchase.associations.supplier.associationType).toBe("BelongsTo");
    expect(Purchase.associations.supplier.target).toBe(Supplier);
    expect(Purchase.associations.currency.associationType).toBe("BelongsTo");
    expect(Purchase.associations.currency.options.foreignKey).toBe(
      "currency_id",
    );
    expect(Purchase.associations.currency.options.as).toBe("currency");
    expect(Purchase.associations.currency.target).toBe(Currency);
  });
});
