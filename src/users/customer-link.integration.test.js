process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  CUSTOMER_USER,
  adminToken,
  as,
  createCustomer,
  createUser,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/customer-link");

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

describe("PUT /users/:id/customer with a real database", () => {
  it("links, replaces and unlinks a customer", async () => {
    const token = await adminToken();
    const user = await createUser(CUSTOMER_USER);
    const first = await createCustomer();
    const second = await createCustomer({ email: "otro@example.com" });

    const linked = await as("put", `/users/${user.id}/customer`, token).send({
      customer_id: first.id,
    });

    expect(linked.status).toBe(202);
    expect(linked.body).toEqual({
      id: user.id,
      username: "cliente",
      email: "cliente@example.com",
      name: "Cliente Demo",
      role: "customer",
      isBlocked: false,
      customer_id: first.id,
      customer: {
        id: first.id,
        fullName: "Cliente Demo",
        latitude: -17.7833,
        longitude: -63.1821,
        direction: "Av. Monseñor Rivero 123",
        email: "cliente@example.com",
      },
    });
    await expect(
      User.findByPk(user.id).then((stored) => stored.customer_id),
    ).resolves.toBe(first.id);

    const replaced = await as("put", `/users/${user.id}/customer`, token).send({
      customer_id: second.id,
    });

    expect(replaced.status).toBe(202);
    expect(replaced.body.customer_id).toBe(second.id);

    const unlinked = await as("put", `/users/${user.id}/customer`, token).send({
      customer_id: null,
    });

    expect(unlinked.status).toBe(202);
    expect(unlinked.body.customer_id).toBeNull();
    expect(unlinked.body.customer).toBeNull();
    await expect(
      User.findByPk(user.id).then((stored) => stored.customer_id),
    ).resolves.toBeNull();
  });

  it("is idempotent when the same customer is sent again", async () => {
    const token = await adminToken();
    const user = await createUser(CUSTOMER_USER);
    const customer = await createCustomer();

    await as("put", `/users/${user.id}/customer`, token).send({
      customer_id: customer.id,
    });
    const response = await as("put", `/users/${user.id}/customer`, token).send({
      customer_id: customer.id,
    });

    expect(response.status).toBe(202);
    expect(response.body.customer_id).toBe(customer.id);
    await expect(
      User.count({ where: { customer_id: customer.id } }),
    ).resolves.toBe(1);
  });

  it("responds 404, 422 and 400 for invalid targets and bodies", async () => {
    const token = await adminToken();
    const user = await createUser(CUSTOMER_USER);
    const seller = await createUser({
      username: "maria",
      email: "maria@superking.com",
      role: "seller",
    });

    const missing = await as("put", `/users/${user.id}/customer`, token).send({
      customer_id: 99999,
    });
    expect(missing.status).toBe(422);
    expect(missing.body).toEqual({
      errors: { customer_id: "Invalid customer" },
    });

    const notCustomer = await as(
      "put",
      `/users/${seller.id}/customer`,
      token,
    ).send({ customer_id: 1 });
    expect(notCustomer.status).toBe(422);
    expect(notCustomer.body).toEqual({
      errors: { customer_id: "User is not a customer" },
    });

    const unknown = await as("put", "/users/99999/customer", token).send({
      customer_id: 1,
    });
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ message: "User not found" });

    const empty = await as("put", `/users/${user.id}/customer`, token).send({});
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ message: "customer_id is required" });

    const invalid = await as("put", `/users/${user.id}/customer`, token).send({
      customer_id: "8",
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { customer_id: "Invalid customer id" },
    });

    const invalidId = await as("put", "/users/abc/customer", token).send({
      customer_id: 1,
    });
    expect(invalidId.status).toBe(422);
    expect(invalidId.body).toEqual({ errors: { id: "Invalid user id" } });
  });

  it("responds 409 when another user already owns the customer", async () => {
    const token = await adminToken();
    const customer = await createCustomer();
    await createUser({ ...CUSTOMER_USER, customer_id: customer.id });
    const other = await createUser({
      username: "otro",
      email: "otro@example.com",
      role: "customer",
    });

    const response = await as("put", `/users/${other.id}/customer`, token).send(
      { customer_id: customer.id },
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Customer is already linked to a user",
    });
  });

  it("responds 401 without a token and 403 for a non administrator", async () => {
    const user = await createUser(CUSTOMER_USER);
    const customer = await createCustomer();

    const anonymous = await request(app)
      .put(`/users/${user.id}/customer`)
      .send({ customer_id: customer.id });
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const sellerToken = await tokenFor({
      username: "maria",
      email: "maria@superking.com",
      role: "seller",
    });
    const forbidden = await as(
      "put",
      `/users/${user.id}/customer`,
      sellerToken,
    ).send({ customer_id: customer.id });

    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });
});
