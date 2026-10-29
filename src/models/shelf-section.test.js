const Shelf = require("./shelf");
const ShelfSection = require("./shelf-section");

describe("ShelfSection model", () => {
  it("defines the documented columns", () => {
    const attributes = ShelfSection.getAttributes();

    expect(attributes.shelf_id.type.key).toBe("INTEGER");
    expect(attributes.shelf_id.allowNull).toBe(false);
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
    expect(ShelfSection.name).toBe("ShelfSection");
    expect(ShelfSection.tableName).toBe("shelf_sections");
  });

  it("belongs to a shelf and registers the inverse association", () => {
    expect(ShelfSection.associations.shelf.associationType).toBe("BelongsTo");
    expect(ShelfSection.associations.shelf.options.foreignKey).toBe("shelf_id");
    expect(ShelfSection.associations.shelf.options.as).toBe("shelf");
    expect(ShelfSection.associations.shelf.target).toBe(Shelf);
    expect(Shelf.associations.sections.target).toBe(ShelfSection);
  });
});
