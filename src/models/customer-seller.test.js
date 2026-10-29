const CustomerSeller = require("./customer-seller");
const Customer = require("./customer");
const User = require("./user");

describe("CustomerSeller model", () => {
  it("defines the required assignment fields in customer_sellers", () => {
    const attributes = CustomerSeller.getAttributes();

    expect(CustomerSeller.name).toBe("CustomerSeller");
    expect(CustomerSeller.tableName).toBe("customer_sellers");
    expect(attributes.customer_id.allowNull).toBe(false);
    expect(attributes.customer_id.unique).toBe(true);
    expect(attributes.seller_id.allowNull).toBe(false);
    expect(attributes.assigned_at.allowNull).toBe(false);
    expect(attributes.assigned_at.type.toString()).toBe(
      "TIMESTAMP WITH TIME ZONE",
    );
  });

  it("belongs to a customer and to a seller user", () => {
    expect(CustomerSeller.associations.customer.target).toBe(Customer);
    expect(CustomerSeller.associations.customer.foreignKey).toBe("customer_id");
    expect(CustomerSeller.associations.seller.target).toBe(User);
    expect(CustomerSeller.associations.seller.foreignKey).toBe("seller_id");
  });

  it("registers the inverse associations", () => {
    expect(Customer.associations.sellerAssignment.target).toBe(CustomerSeller);
    expect(User.associations.customerAssignments.target).toBe(CustomerSeller);
  });

  it("defaults assigned_at when a row is built", () => {
    const instance = CustomerSeller.build({ customer_id: 1, seller_id: 2 });

    expect(instance.get("assigned_at")).toBeInstanceOf(Date);
  });
});
