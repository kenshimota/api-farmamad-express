const Product = require("./product");
const Category = require("./category");
const Image = require("./image");
const Tax = require("./tax");

describe("Product model", () => {
  it("defines the required catalog columns with their limits", () => {
    const attributes = Product.getAttributes();

    expect(attributes.name.type.toString()).toBe("VARCHAR(150)");
    expect(attributes.name.allowNull).toBe(false);
    expect(attributes.description.type.toString()).toBe("TEXT");
    expect(attributes.description.allowNull).toBe(false);
    expect(attributes.reference.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.reference.allowNull).toBe(false);
    expect(attributes.reference.unique).toBe(true);
  });

  it("defines both foreign keys and the required tax as integer columns", () => {
    const attributes = Product.getAttributes();

    expect(attributes.category_id.type.key).toBe("INTEGER");
    expect(attributes.category_id.allowNull).toBe(false);
    expect(attributes.image_id.type.key).toBe("INTEGER");
    expect(attributes.image_id.allowNull).toBe(false);
    expect(attributes.tax_id.type.key).toBe("INTEGER");
    expect(attributes.tax_id.allowNull).toBe(false);
  });

  it("uses the documented model and table names", () => {
    expect(Product.name).toBe("Product");
    expect(Product.tableName).toBe("products");
  });

  it("belongs to Category, Image and Tax", () => {
    expect(Product.associations.category.associationType).toBe("BelongsTo");
    expect(Product.associations.category.options.foreignKey).toBe(
      "category_id",
    );
    expect(Product.associations.category.options.as).toBe("category");
    expect(Product.associations.image.associationType).toBe("BelongsTo");
    expect(Product.associations.image.options.foreignKey).toBe("image_id");
    expect(Product.associations.image.options.as).toBe("image");
    expect(Product.associations.tax.associationType).toBe("BelongsTo");
    expect(Product.associations.tax.options.foreignKey).toBe("tax_id");
    expect(Product.associations.tax.options.as).toBe("tax");
  });

  it("is associated with products from Category, Image and Tax", () => {
    expect(Category.associations.products.associationType).toBe("HasMany");
    expect(Category.associations.products.options.foreignKey).toBe(
      "category_id",
    );
    expect(Category.associations.products.options.as).toBe("products");
    expect(Image.associations.products.associationType).toBe("HasMany");
    expect(Image.associations.products.options.foreignKey).toBe("image_id");
    expect(Image.associations.products.options.as).toBe("products");
    expect(Tax.associations.products.associationType).toBe("HasMany");
    expect(Tax.associations.products.options.foreignKey).toBe("tax_id");
    expect(Tax.associations.products.options.as).toBe("products");
  });
});
