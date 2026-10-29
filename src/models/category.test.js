const Category = require("./category");

describe("Category model", () => {
  it("defines name as a required, unique, 100 character column", () => {
    const attributes = Category.getAttributes();

    expect(attributes.name.allowNull).toBe(false);
    expect(attributes.name.unique).toBe(true);
    expect(attributes.name.type.toString()).toBe("VARCHAR(100)");
  });

  it("uses the documented model and table names", () => {
    expect(Category.name).toBe("Category");
    expect(Category.tableName).toBe("categories");
  });
});
