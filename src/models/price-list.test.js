const PriceList = require("./price-list");
const Customer = require("./customer");

describe("PriceList model", () => {
  it("defines the documented columns with their precision", () => {
    const attributes = PriceList.getAttributes();

    expect(attributes.name.type.toString()).toBe("VARCHAR(150)");
    expect(attributes.name.allowNull).toBe(false);
    expect(attributes.description.type.toString()).toBe("VARCHAR(500)");
    expect(attributes.description.allowNull).toBe(true);
    expect(attributes.description.defaultValue).toBeNull();
    expect(attributes.percentage.type.toString()).toBe("DECIMAL(5,2)");
    expect(attributes.percentage.allowNull).toBe(false);
  });

  it("uses the documented model and table names", () => {
    expect(PriceList.name).toBe("PriceList");
    expect(PriceList.tableName).toBe("price_lists");
  });

  it("associates customers in both directions", () => {
    expect(PriceList.associations.customers.associationType).toBe("HasMany");
    expect(PriceList.associations.customers.options.foreignKey).toBe(
      "price_list_id",
    );
    expect(PriceList.associations.customers.options.as).toBe("customers");
    expect(PriceList.associations.customers.target).toBe(Customer);

    expect(Customer.associations.price_list.associationType).toBe("BelongsTo");
    expect(Customer.associations.price_list.options.foreignKey).toBe(
      "price_list_id",
    );
    expect(Customer.associations.price_list.options.as).toBe("price_list");
    expect(Customer.associations.price_list.target).toBe(PriceList);
  });

  it("adds the nullable price_list_id foreign key to the customer model", () => {
    const attributes = Customer.getAttributes();

    expect(attributes.price_list_id.type.key).toBe("INTEGER");
    expect(attributes.price_list_id.allowNull).toBe(true);
  });
});
