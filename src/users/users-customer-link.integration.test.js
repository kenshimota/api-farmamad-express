process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const sequelize = require("../database");
const User = require("../models/user");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  CUSTOMER_USER,
  PASSWORD,
  adminToken,
  as,
  createCustomer,
  createUser,
  resetDatabase,
} = require("../../test/helpers/customer-link");

const BODY = {
  username: "cliente",
  email: "cliente@example.com",
  password: PASSWORD,
  name: "Cliente Demo",
  role: "customer",
};

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

describe("POST /users with customer_id and a real database", () => {
  it("creates the user and the link in a single operation", async () => {
    const token = await adminToken();
    const customer = await createCustomer();

    const response = await as("post", "/users", token).send({
      ...BODY,
      customer_id: customer.id,
    });

    expect(response.status).toBe(201);
    expect(response.body.customer_id).toBe(customer.id);
    expect(response.body.customer).toEqual({
      id: customer.id,
      fullName: "Cliente Demo",
      latitude: -17.7833,
      longitude: -63.1821,
      direction: "Av. Monseñor Rivero 123",
      email: "cliente@example.com",
    });

    const stored = await User.findByPk(response.body.id);
    expect(stored.customer_id).toBe(customer.id);
  });

  it("answers 422 for a non customer role or an unknown customer", async () => {
    const token = await adminToken();
    const customer = await createCustomer();

    const wrongRole = await as("post", "/users", token).send({
      ...BODY,
      role: "seller",
      customer_id: customer.id,
    });
    expect(wrongRole.status).toBe(422);
    expect(wrongRole.body).toEqual({
      errors: { customer_id: "User is not a customer" },
    });

    const unknown = await as("post", "/users", token).send({
      ...BODY,
      customer_id: 99999,
    });
    expect(unknown.status).toBe(422);
    expect(unknown.body).toEqual({
      errors: { customer_id: "Invalid customer" },
    });
  });

  it("answers 409 and leaves no half created user when the customer is taken", async () => {
    const token = await adminToken();
    const customer = await createCustomer();
    await createUser({ ...CUSTOMER_USER, customer_id: customer.id });

    const response = await as("post", "/users", token).send({
      ...BODY,
      username: "otro",
      email: "otro@example.com",
      customer_id: customer.id,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Customer is already linked to a user",
    });
    await expect(
      User.findOne({ where: { username: "otro" } }),
    ).resolves.toBeNull();
  });

  it("enforces the unique customer link and the foreign key", async () => {
    const customer = await createCustomer();

    await createUser({ ...CUSTOMER_USER, customer_id: customer.id });

    await expect(
      createUser({
        username: "otro",
        email: "otro@example.com",
        customer_id: customer.id,
      }),
    ).rejects.toBeInstanceOf(UniqueConstraintError);

    await expect(
      createUser({
        username: "tercero",
        email: "tercero@example.com",
        customer_id: 999999,
      }),
    ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
  });
});
