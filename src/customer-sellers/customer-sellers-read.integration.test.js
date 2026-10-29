process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
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

/**
 * Builds two customers, two sellers and their assignments.
 * @returns {Promise<object>} The fixtures.
 */
async function createFixtures() {
  const firstCustomer = await createCustomer({
    fullName: "Cliente Uno",
    email: "uno@example.com",
  });
  const secondCustomer = await createCustomer({
    fullName: "Cliente Dos",
    email: "dos@example.com",
  });
  const firstSeller = await createActor("seller");
  const secondSeller = await createActor("seller");
  const first = await createAssignment(firstCustomer, firstSeller.user);
  const second = await createAssignment(secondCustomer, secondSeller.user);

  return {
    firstCustomer,
    secondCustomer,
    firstSeller,
    secondSeller,
    first,
    second,
  };
}

describe("GET /customer-sellers with a real database", () => {
  it("lists every assignment ordered by customer_id with nested relations", async () => {
    await createFixtures();
    const token = await tokenFor("admin");

    const response = await as("get", "/customer-sellers", token);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].customer_id).toBeLessThan(
      response.body[1].customer_id,
    );
    expect(response.body[0]).toEqual(
      expect.objectContaining({
        customer: expect.objectContaining({
          id: expect.any(Number),
          fullName: expect.any(String),
          email: expect.any(String),
          direction: expect.any(String),
        }),
        seller: expect.objectContaining({
          id: expect.any(Number),
          username: expect.any(String),
          email: expect.any(String),
          name: expect.any(String),
        }),
      }),
    );
    expect(response.body[0]).not.toHaveProperty("createdAt");
    expect(response.body[0]).not.toHaveProperty("updatedAt");
  });

  it("filters by customer_id and seller_id", async () => {
    const fixtures = await createFixtures();
    const token = await tokenFor("dispatcher");

    const byCustomer = await as(
      "get",
      `/customer-sellers?customer_id=${fixtures.secondCustomer.id}`,
      token,
    );
    expect(byCustomer.body).toHaveLength(1);
    expect(byCustomer.body[0].id).toBe(fixtures.second.id);

    const bySeller = await as(
      "get",
      `/customer-sellers?seller_id=${fixtures.firstSeller.user.id}`,
      token,
    );
    expect(bySeller.body).toHaveLength(1);
    expect(bySeller.body[0].id).toBe(fixtures.first.id);
  });

  it("forces a seller to see only their own assignments", async () => {
    const fixtures = await createFixtures();

    const response = await as(
      "get",
      "/customer-sellers",
      fixtures.firstSeller.token,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].seller_id).toBe(fixtures.firstSeller.user.id);

    const forbidden = await as(
      "get",
      `/customer-sellers?seller_id=${fixtures.secondSeller.user.id}`,
      fixtures.firstSeller.token,
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });

  it("returns an empty array for a customer without assignment", async () => {
    const customer = await createCustomer({ email: "free@example.com" });
    const token = await tokenFor("admin");

    const response = await as(
      "get",
      `/customer-sellers?customer_id=${customer.id}`,
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns the detail to admin, dispatcher and the owner seller", async () => {
    const fixtures = await createFixtures();
    const tokens = [
      await tokenFor("admin"),
      await tokenFor("dispatcher"),
      fixtures.firstSeller.token,
    ];

    for (const token of tokens) {
      const response = await as(
        "get",
        `/customer-sellers/${fixtures.first.id}`,
        token,
      );

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(fixtures.first.id);
    }
  });

  it("responds 403 for another seller, 404 for missing and 422 for invalid ids", async () => {
    const fixtures = await createFixtures();

    const forbidden = await as(
      "get",
      `/customer-sellers/${fixtures.first.id}`,
      fixtures.secondSeller.token,
    );
    expect(forbidden.status).toBe(403);

    const token = await tokenFor("admin");
    const missing = await as("get", "/customer-sellers/999999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Assignment not found" });

    const invalid = await as("get", "/customer-sellers/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid assignment id" },
    });
  });

  it.each(["manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("get", "/customer-sellers", token);

      expect(response.status).toBe(403);
    },
  );

  it("responds 401 without a token", async () => {
    const response = await request(app).get("/customer-sellers");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
