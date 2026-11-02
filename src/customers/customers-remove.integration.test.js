process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Customer = require("../models/customer");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createCustomer,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/customers");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterAll(async () => {
  await sequelize.close();
});

describe("DELETE /customers/:id with a real database", () => {
  it("deletes the customer and answers 204 without body", async () => {
    const customer = await createCustomer();
    const token = await tokenFor("seller");

    const response = await as("delete", `/customers/${customer.id}`, token);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    await expect(Customer.findByPk(customer.id)).resolves.toBeNull();
  });

  it("responds 404 for an unknown customer and 422 for an invalid id", async () => {
    const token = await tokenFor("admin");

    const missing = await as("delete", "/customers/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Customer not found" });

    const invalid = await as("delete", "/customers/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid customer id" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const customer = await createCustomer();
    const token = await tokenFor("dispatcher");

    const response = await as("delete", `/customers/${customer.id}`, token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});
