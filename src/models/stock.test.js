const Stock = require("./stock");
const Product = require("./product");
const ItemState = require("./item-state");
const Cost = require("./cost");

describe("Stock model", () => {
  it("defines the required stock columns and the non-negative default", () => {
    const attributes = Stock.getAttributes();

    expect(attributes.product_id.type.key).toBe("INTEGER");
    expect(attributes.product_id.allowNull).toBe(false);
    expect(attributes.item_state_id.type.key).toBe("INTEGER");
    expect(attributes.item_state_id.allowNull).toBe(false);
    expect(attributes.quantity.type.key).toBe("INTEGER");
    expect(attributes.quantity.allowNull).toBe(false);
    expect(attributes.quantity.defaultValue).toBe(0);
  });

  it("uses the documented model and table names", () => {
    expect(Stock.name).toBe("Stock");
    expect(Stock.tableName).toBe("stocks");
  });

  it("belongs to Product and ItemState through their foreign keys", () => {
    expect(Stock.associations.product.associationType).toBe("BelongsTo");
    expect(Stock.associations.product.options.foreignKey).toBe("product_id");
    expect(Stock.associations.product.options.as).toBe("product");
    expect(Stock.associations.product.target).toBe(Product);
    expect(Stock.associations.item_state.associationType).toBe("BelongsTo");
    expect(Stock.associations.item_state.options.foreignKey).toBe(
      "item_state_id",
    );
    expect(Stock.associations.item_state.options.as).toBe("item_state");
    expect(Stock.associations.item_state.target).toBe(ItemState);
  });

  it("registers the inverse associations without a circular require", () => {
    expect(Product.associations.stocks.associationType).toBe("HasMany");
    expect(Product.associations.stocks.options.foreignKey).toBe("product_id");
    expect(Product.associations.stocks.options.as).toBe("stocks");
    expect(ItemState.associations.stocks.associationType).toBe("HasMany");
    expect(ItemState.associations.stocks.options.foreignKey).toBe(
      "item_state_id",
    );
    expect(ItemState.associations.stocks.options.as).toBe("stocks");
  });

  it("associates the current cost for the available view", () => {
    expect(Stock.associations.cost.associationType).toBe("HasOne");
    expect(Stock.associations.cost.options.as).toBe("cost");
    expect(Stock.associations.cost.target).toBe(Cost);
  });
});
