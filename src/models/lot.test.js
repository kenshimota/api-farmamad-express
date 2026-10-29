const Lot = require("./lot");
const Product = require("./product");
const ItemState = require("./item-state");
const Warehouse = require("./warehouse");
const Shelf = require("./shelf");
const ShelfSection = require("./shelf-section");

describe("Lot model", () => {
  it("defines the documented columns and quantity defaults", () => {
    const attributes = Lot.getAttributes();

    expect(attributes.number.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.number.allowNull).toBe(false);
    expect(attributes.product_id.type.key).toBe("INTEGER");
    expect(attributes.product_id.allowNull).toBe(false);
    expect(attributes.expiration_date.type.key).toBe("DATEONLY");
    expect(attributes.expiration_date.allowNull).toBe(false);
    expect(attributes.item_state_id.type.key).toBe("INTEGER");
    expect(attributes.item_state_id.allowNull).toBe(false);
    expect(attributes.stock.type.key).toBe("INTEGER");
    expect(attributes.stock.allowNull).toBe(false);
    expect(attributes.stock.defaultValue).toBe(0);
    expect(attributes.reserved.type.key).toBe("INTEGER");
    expect(attributes.reserved.allowNull).toBe(false);
    expect(attributes.reserved.defaultValue).toBe(0);
    expect(attributes.warehouse_id.type.key).toBe("INTEGER");
    expect(attributes.warehouse_id.allowNull).toBe(false);
    expect(attributes.shelf_id.type.key).toBe("INTEGER");
    expect(attributes.shelf_id.allowNull).toBe(false);
    expect(attributes.section_id.type.key).toBe("INTEGER");
    expect(attributes.section_id.allowNull).toBe(false);
  });

  it("uses the documented model and table names", () => {
    expect(Lot.name).toBe("Lot");
    expect(Lot.tableName).toBe("lots");
  });

  it("belongs to the five referenced models with the expected aliases", () => {
    const expected = [
      ["product", "product_id", Product],
      ["item_state", "item_state_id", ItemState],
      ["warehouse", "warehouse_id", Warehouse],
      ["shelf", "shelf_id", Shelf],
      ["section", "section_id", ShelfSection],
    ];

    for (const [alias, foreignKey, target] of expected) {
      expect(Lot.associations[alias].associationType).toBe("BelongsTo");
      expect(Lot.associations[alias].options.foreignKey).toBe(foreignKey);
      expect(Lot.associations[alias].options.as).toBe(alias);
      expect(Lot.associations[alias].target).toBe(target);
    }
  });

  it("registers the inverse hasMany associations", () => {
    for (const model of [Product, ItemState, Warehouse, Shelf, ShelfSection]) {
      expect(model.associations.lots.associationType).toBe("HasMany");
      expect(model.associations.lots.target).toBe(Lot);
    }
  });
});
