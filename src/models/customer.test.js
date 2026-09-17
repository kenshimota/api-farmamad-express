const Customer = require("./customer");

describe("Customer model", () => {
  it("defines the required fields and the unique email", () => {
    const attributes = Customer.getAttributes();

    expect(attributes.fullName.allowNull).toBe(false);
    expect(attributes.direction.allowNull).toBe(false);
    expect(attributes.email.allowNull).toBe(false);
    expect(attributes.email.unique).toBe(true);
    expect(attributes.email.validate.isEmail).toBe(true);
  });

  it("stores latitude and longitude as DECIMAL(10,7)", () => {
    const attributes = Customer.getAttributes();

    expect(attributes.latitude.type.toString()).toBe("DECIMAL(10,7)");
    expect(attributes.longitude.type.toString()).toBe("DECIMAL(10,7)");
    expect(attributes.latitude.allowNull).toBe(false);
    expect(attributes.longitude.allowNull).toBe(false);
  });

  it("defines isRegistered as a non-null boolean defaulting to false", () => {
    const attributes = Customer.getAttributes();

    expect(attributes.isRegistered.type.toString()).toBe("BOOLEAN");
    expect(attributes.isRegistered.allowNull).toBe(false);
    expect(attributes.isRegistered.defaultValue).toBe(false);
  });

  it("uses the documented model and table names", () => {
    expect(Customer.name).toBe("Customer");
    expect(Customer.tableName).toBe("customers");
  });

  it("defaults isRegistered to false when a customer is built", () => {
    const instance = Customer.build({
      fullName: "Juan Pérez",
      latitude: -17.7833,
      longitude: -63.1821,
      direction: "Av. Monseñor Rivero 123",
      email: "juan@example.com",
    });

    expect(instance.get("isRegistered")).toBe(false);
  });

  it("serializes only the public fields and coordinates as numbers", () => {
    const instance = Customer.build({
      id: 1,
      fullName: "Juan Pérez",
      latitude: "-17.7833000",
      longitude: "-63.1821000",
      direction: "Av. Monseñor Rivero 123",
      email: "juan@example.com",
      isRegistered: true,
    });

    expect(instance.toJSON()).toEqual({
      id: 1,
      fullName: "Juan Pérez",
      latitude: -17.7833,
      longitude: -63.1821,
      direction: "Av. Monseñor Rivero 123",
      email: "juan@example.com",
    });
    expect(instance.toJSON()).not.toHaveProperty("isRegistered");
    expect(instance.toJSON()).not.toHaveProperty("createdAt");
    expect(instance.toJSON()).not.toHaveProperty("updatedAt");
  });

  it("serializes null coordinates as null", () => {
    const instance = Customer.build({
      fullName: "Juan Pérez",
      latitude: null,
      longitude: null,
      direction: "Av. Monseñor Rivero 123",
      email: "juan@example.com",
    });

    expect(instance.toJSON()).toEqual(
      expect.objectContaining({ latitude: null, longitude: null }),
    );
  });
});
