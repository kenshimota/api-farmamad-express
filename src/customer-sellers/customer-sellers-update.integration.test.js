process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const Customer = require("../models/customer");
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

describe("PUT /customer-sellers/:id with a real database", () => {
  it("reassigns the seller, refreshes assigned_at and answers 202", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");
    const newSeller = await createActor("seller");
    const assignment = await createAssignment(customer, seller.user);
    const token = await tokenFor("admin");

    const response = await as(
      "put",
      `/customer-sellers/${assignment.id}`,
      token,
    ).send({ seller_id: newSeller.user.id });

    expect(response.status).toBe(202);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: assignment.id,
        customer_id: customer.id,
        seller_id: newSeller.user.id,
        seller: expect.objectContaining({ id: newSeller.user.id }),
      }),
    );
    expect(new Date(response.body.assigned_at).getTime()).toBeGreaterThan(
      assignment.assigned_at.getTime(),
    );

    const stored = await CustomerSeller.findByPk(assignment.id);
    expect(stored.seller_id).toBe(newSeller.user.id);
    await expect(CustomerSeller.count()).resolves.toBe(1);
  });

  it("allows a seller to keep the assignment to themselves", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");
    const assignment = await createAssignment(customer, seller.user);

    const response = await as(
      "put",
      `/customer-sellers/${assignment.id}`,
      seller.token,
    ).send({ seller_id: seller.user.id });

    expect(response.status).toBe(202);
  });

  it("responds 403 when a seller updates another assignment or hands it away", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");
    const other = await createActor("seller");
    const assignment = await createAssignment(customer, seller.user);

    const foreign = await as(
      "put",
      `/customer-sellers/${assignment.id}`,
      other.token,
    ).send({ seller_id: other.user.id });
    expect(foreign.status).toBe(403);

    const handOver = await as(
      "put",
      `/customer-sellers/${assignment.id}`,
      seller.token,
    ).send({ seller_id: other.user.id });
    expect(handOver.status).toBe(403);
  });

  it("rejects a different customer_id and accepts the same one", async () => {
    const customer = await createCustomer();
    const otherCustomer = await createCustomer({ email: "other@example.com" });
    const seller = await createActor("seller");
    const assignment = await createAssignment(customer, seller.user);
    const token = await tokenFor("admin");

    const changed = await as(
      "put",
      `/customer-sellers/${assignment.id}`,
      token,
    ).send({ seller_id: seller.user.id, customer_id: otherCustomer.id });
    expect(changed.status).toBe(422);
    expect(changed.body).toEqual({
      errors: { customer_id: "customer_id cannot be changed" },
    });

    const same = await as(
      "put",
      `/customer-sellers/${assignment.id}`,
      token,
    ).send({ seller_id: seller.user.id, customer_id: customer.id });
    expect(same.status).toBe(202);
  });

  it("responds 422 for an invalid seller and 404/422 for missing or invalid ids", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");
    const assignment = await createAssignment(customer, seller.user);
    const token = await tokenFor("admin");

    const invalidSeller = await as(
      "put",
      `/customer-sellers/${assignment.id}`,
      token,
    ).send({ seller_id: 999999 });
    expect(invalidSeller.status).toBe(422);
    expect(invalidSeller.body).toEqual({
      errors: { seller_id: "Invalid seller" },
    });

    const missing = await as("put", "/customer-sellers/999999", token).send({
      seller_id: seller.user.id,
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Assignment not found" });

    const invalid = await as("put", "/customer-sellers/abc", token).send({
      seller_id: seller.user.id,
    });
    expect(invalid.status).toBe(422);
  });

  it("responds 403 for a dispatcher", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");
    const assignment = await createAssignment(customer, seller.user);
    const token = await tokenFor("dispatcher");

    const response = await as(
      "put",
      `/customer-sellers/${assignment.id}`,
      token,
    ).send({ seller_id: seller.user.id });

    expect(response.status).toBe(403);
  });
});

describe("DELETE /customer-sellers/:id with a real database", () => {
  it("removes only the assignment and keeps the customer and seller", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");
    const assignment = await createAssignment(customer, seller.user);
    const token = await tokenFor("admin");

    const response = await as(
      "delete",
      `/customer-sellers/${assignment.id}`,
      token,
    );

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    await expect(CustomerSeller.findByPk(assignment.id)).resolves.toBeNull();
    await expect(Customer.findByPk(customer.id)).resolves.not.toBeNull();
  });

  it("allows the owner seller and rejects another seller or a missing row", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");
    const other = await createActor("seller");
    const assignment = await createAssignment(customer, seller.user);

    const forbidden = await as(
      "delete",
      `/customer-sellers/${assignment.id}`,
      other.token,
    );
    expect(forbidden.status).toBe(403);

    const response = await as(
      "delete",
      `/customer-sellers/${assignment.id}`,
      seller.token,
    );
    expect(response.status).toBe(204);

    const missing = await as(
      "delete",
      `/customer-sellers/${assignment.id}`,
      seller.token,
    );
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Assignment not found" });
  });

  it("responds 401 without a token and 403 for a dispatcher", async () => {
    const customer = await createCustomer();
    const seller = await createActor("seller");
    const assignment = await createAssignment(customer, seller.user);
    const dispatcher = await tokenFor("dispatcher");

    const anonymous = await request(app).delete(
      `/customer-sellers/${assignment.id}`,
    );
    expect(anonymous.status).toBe(401);

    const forbidden = await as(
      "delete",
      `/customer-sellers/${assignment.id}`,
      dispatcher,
    );
    expect(forbidden.status).toBe(403);
  });
});
