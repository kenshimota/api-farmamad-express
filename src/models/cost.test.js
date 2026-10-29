const Cost = require("./cost");
const Product = require("./product");
const ItemState = require("./item-state");
const Currency = require("./currency");

describe("Cost model", () => {
  it("defines the required monetary columns with the documented precision", () => {
    const attributes = Cost.getAttributes();

    expect(attributes.product_id.type.key).toBe("INTEGER");
    expect(attributes.product_id.allowNull).toBe(false);
    expect(attributes.item_state_id.type.key).toBe("INTEGER");
    expect(attributes.item_state_id.allowNull).toBe(false);
    expect(attributes.cost.type.toString()).toBe("DECIMAL(12,2)");
    expect(attributes.cost.allowNull).toBe(false);
    expect(attributes.currency_id.type.key).toBe("INTEGER");
    expect(attributes.currency_id.allowNull).toBe(false);
  });

  it("uses the documented model and table names", () => {
    expect(Cost.name).toBe("Cost");
    expect(Cost.tableName).toBe("costs");
  });

  it("belongs to Product and ItemState through their foreign keys", () => {
    expect(Cost.associations.product.associationType).toBe("BelongsTo");
    expect(Cost.associations.product.options.foreignKey).toBe("product_id");
    expect(Cost.associations.product.options.as).toBe("product");
    expect(Cost.associations.product.target).toBe(Product);
    expect(Cost.associations.item_state.associationType).toBe("BelongsTo");
    expect(Cost.associations.item_state.options.foreignKey).toBe(
      "item_state_id",
    );
    expect(Cost.associations.item_state.options.as).toBe("item_state");
    expect(Cost.associations.item_state.target).toBe(ItemState);
  });

  it("belongs to Currency through currency_id", () => {
    expect(Cost.associations.currency.associationType).toBe("BelongsTo");
    expect(Cost.associations.currency.options.foreignKey).toBe("currency_id");
    expect(Cost.associations.currency.options.as).toBe("currency");
    expect(Cost.associations.currency.target).toBe(Currency);
    expect(Currency.associations.costs.associationType).toBe("HasMany");
    expect(Currency.associations.costs.options.foreignKey).toBe("currency_id");
  });

  it("registers the inverse associations without a circular require", () => {
    expect(Product.associations.costs.associationType).toBe("HasMany");
    expect(Product.associations.costs.options.foreignKey).toBe("product_id");
    expect(Product.associations.costs.options.as).toBe("costs");
    expect(ItemState.associations.costs.associationType).toBe("HasMany");
    expect(ItemState.associations.costs.options.foreignKey).toBe(
      "item_state_id",
    );
    expect(ItemState.associations.costs.options.as).toBe("costs");
  });
});
