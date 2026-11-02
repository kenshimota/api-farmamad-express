process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const Role = require("../models/role");
const Customer = require("../models/customer");
const { assertTestDatabase } = require("../../test/helpers/test-database");

const PASSWORD = "secret123";

/**
 * Resolves a role id from the seeded roles table.
 * @param {string} name - Role name.
 * @returns {Promise<number>} The role primary key.
 */
async function getRoleId(name) {
  const role = await Role.findOne({ where: { name } });

  if (!role) {
    throw new Error(`Role "${name}" is not seeded`);
  }

  return role.id;
}

/**
 * Creates a customer user, optionally linked to a customer.
 * @param {number|null} [customerId] - Customer id to link.
 * @returns {Promise<object>} The created user.
 */
async function createCustomerUser(customerId = null) {
  return User.create({
    username: "cliente",
    email: "cliente@example.com",
    name: "Cliente Demo",
    password: PASSWORD,
    roleId: await getRoleId("customer"),
    customer_id: customerId,
  });
}

/**
 * Creates a customer in the test database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created customer.
 */
function createCustomer(overrides = {}) {
  return Customer.create({
    fullName: "Cliente Demo",
    latitude: -17.7833,
    longitude: -63.1821,
    direction: "Av. Monseñor Rivero 123",
    email: "cliente@example.com",
    ...overrides,
  });
}

const publicCustomer = {
  id: expect.any(Number),
  fullName: "Cliente Demo",
  latitude: -17.7833,
  longitude: -63.1821,
  direction: "Av. Monseñor Rivero 123",
  email: "cliente@example.com",
};

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await User.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await Customer.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
});

afterAll(async () => {
  await sequelize.close();
});

describe("customer link in authentication with a real database", () => {
  it("includes the linked customer on login and GET /auth/me", async () => {
    const customer = await createCustomer();
    const user = await createCustomerUser(customer.id);

    const login = await request(app)
      .post("/auth/login")
      .send({ identifier: "cliente", password: PASSWORD });

    expect(login.status).toBe(200);
    expect(login.body.user).toEqual({
      id: user.id,
      username: "cliente",
      email: "cliente@example.com",
      name: "Cliente Demo",
      role: "customer",
      isBlocked: false,
      customer_id: customer.id,
      customer: publicCustomer,
    });
    expect(login.body.user.customer).not.toHaveProperty("isRegistered");
    expect(login.body.user.customer).not.toHaveProperty("createdAt");

    const me = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);

    expect(me.status).toBe(200);
    expect(me.body).toEqual(login.body.user);
  });

  it("returns null customer fields when the user has no link", async () => {
    await createCustomerUser();

    const response = await request(app)
      .post("/auth/login")
      .send({ identifier: "cliente", password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.user.customer_id).toBeNull();
    expect(response.body.user.customer).toBeNull();
  });
});
