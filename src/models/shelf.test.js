const Shelf = require("./shelf");
const ShelfSection = require("./shelf-section");
const Warehouse = require("./warehouse");

describe("Shelf model", () => {
  it("defines the documented columns", () => {
    const attributes = Shelf.getAttributes();

    expect(attributes.warehouse_id.type.key).toBe("INTEGER");
    expect(attributes.warehouse_id.allowNull).toBe(false);
    expect(attributes.code.type.toString()).toBe("VARCHAR(50)");
    expect(attributes.code.allowNull).toBe(false);
    expect(attributes.name.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.name.allowNull).toBe(true);
    expect(attributes.name.defaultValue).toBeNull();
    expect(attributes.description.type.toString()).toBe("VARCHAR(255)");
    expect(attributes.description.allowNull).toBe(true);
    expect(attributes.description.defaultValue).toBeNull();
  });

  it("uses the documented model and table names", () => {
    expect(Shelf.name).toBe("Shelf");
    expect(Shelf.tableName).toBe("shelves");
  });

  it("belongs to a warehouse", () => {
    expect(Shelf.associations.warehouse.associationType).toBe("BelongsTo");
    expect(Shelf.associations.warehouse.options.foreignKey).toBe(
      "warehouse_id",
    );
    expect(Shelf.associations.warehouse.options.as).toBe("warehouse");
    expect(Shelf.associations.warehouse.target).toBe(Warehouse);
    expect(Warehouse.associations.shelves.associationType).toBe("HasMany");
    expect(Warehouse.associations.shelves.options.foreignKey).toBe(
      "warehouse_id",
    );
    expect(Warehouse.associations.shelves.options.as).toBe("shelves");
  });

  it("has many sections ordered by code", () => {
    expect(Shelf.associations.sections.associationType).toBe("HasMany");
    expect(Shelf.associations.sections.options.foreignKey).toBe("shelf_id");
    expect(Shelf.associations.sections.options.as).toBe("sections");
    expect(Shelf.associations.sections.target).toBe(ShelfSection);
  });
});
