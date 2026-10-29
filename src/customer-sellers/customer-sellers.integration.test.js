process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const CustomerSeller = require("../models/customer-seller");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createActor,
  createAssignment,
  createCustomer,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/customer-sellers");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await sequelize.close();
});

describe("POST /customer-sellers with a real database", () => {
  it("creates the assignment and serializes the customer and seller", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");
    const token = await tokenFor("admin");

    const response = await as("post", "/customer-sellers", token).send({
      customer_id: customer.id,
      seller_id: seller.user.id,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      customer_id: customer.id,
      seller_id: seller.user.id,
      assigned_at: expect.any(String),
      customer: {
        id: customer.id,
        fullName: "Juan Pérez",
        email: "juan@example.com",
        direction: "Av. Monseñor Rivero 123",
      },
      seller: {
        id: seller.user.id,
        username: seller.user.username,
        email: seller.user.email,
        name: "María",
      },
    });
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body).not.toHaveProperty("updatedAt");

    const stored = await CustomerSeller.findByPk(response.body.id);
    expect(stored.customer_id).toBe(customer.id);
  });

  it("allows a seller to assign a customer to themselves", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");

    const response = await as("post", "/customer-sellers", seller.token).send({
      customer_id: customer.id,
      seller_id: seller.user.id,
    });

    expect(response.status).toBe(201);
  });

  it("responds 403 when a seller assigns another seller", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");
    const other = await createActor("seller");

    const response = await as("post", "/customer-sellers", seller.token).send({
      customer_id: customer.id,
      seller_id: other.user.id,
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("rejects unknown, non-seller and blocked users with 422", async () => {
    const customer = await createCustomer();
    const dispatcher = await createActor("dispatcher");
    const blocked = await createActor("seller");
    await User.update({ isBlocked: true }, { where: { id: blocked.user.id } });
    const token = await tokenFor("admin");

    for (const sellerId of [999999, dispatcher.user.id, blocked.user.id]) {
      const response = await as("post", "/customer-sellers", token).send({
        customer_id: customer.id,
        seller_id: sellerId,
      });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { seller_id: "Invalid seller" },
      });
    }
  });

  it("responds 422 for an unknown customer and 400 for missing fields", async () => {
    const token = await tokenFor("admin");

    const unknown = await as("post", "/customer-sellers", token).send({
      customer_id: 999999,
      seller_id: 1,
    });
    expect(unknown.status).toBe(422);
    expect(unknown.body).toEqual({
      errors: { customer_id: "Invalid customer" },
    });

    const missing = await as("post", "/customer-sellers", token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message: "customer_id and seller_id are required",
    });
  });

  it("responds 409 when the customer already has a seller", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");
    await createAssignment(customer, seller.user);
    const token = await tokenFor("admin");

    const response = await as("post", "/customer-sellers", token).send({
      customer_id: customer.id,
      seller_id: seller.user.id,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Customer already has a seller",
    });
    await expect(CustomerSeller.count()).resolves.toBe(1);
  });

  it("keeps a single row when two POST requests race", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");
    const token = await tokenFor("admin");
    const body = { customer_id: customer.id, seller_id: seller.user.id };

    const responses = await Promise.all([
      as("post", "/customer-sellers", token).send(body),
      as("post", "/customer-sellers", token).send(body),
    ]);
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses).toEqual([201, 409]);
    await expect(CustomerSeller.count()).resolves.toBe(1);
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const customer = await createCustomer();
      const seller = await createActor("seller");
      const token = await tokenFor(role);

      const response = await as("post", "/customer-sellers", token).send({
        customer_id: customer.id,
        seller_id: seller.user.id,
      });

      expect(response.status).toBe(403);
    },
  );

  it("responds 401 without a token", async () => {
    const response = await request(app).post("/customer-sellers").send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("deletes the assignment when the customer or the seller is removed", async () => {
    const firstCustomer = await createCustomer();
    const firstSeller = await createActor("seller");
    const first = await createAssignment(firstCustomer, firstSeller.user);
    await firstCustomer.destroy();
    await expect(CustomerSeller.findByPk(first.id)).resolves.toBeNull();

    const secondCustomer = await createCustomer({
      email: "second@example.com",
    });
    const secondSeller = await createActor("seller");
    const second = await createAssignment(secondCustomer, secondSeller.user);
    await secondSeller.user.destroy();
    await expect(CustomerSeller.findByPk(second.id)).resolves.toBeNull();
  });

  it("keeps the row when the seller role changes after assignment", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");
    const assignment = await createAssignment(customer, seller.user);
    const dispatcherRole = require("../../src/models/role");

    await User.update(
      {
        roleId: (
          await dispatcherRole.findOne({ where: { name: "dispatcher" } })
        ).id,
      },
      { where: { id: seller.user.id } },
    );

    await expect(
      CustomerSeller.findByPk(assignment.id),
    ).resolves.not.toBeNull();
  });
});
