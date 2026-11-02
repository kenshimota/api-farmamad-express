process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const { ForeignKeyConstraintError } = require("sequelize");
const app = require("../app");
const sequelize = require("../database");
const PriceList = require("../models/price-list");
const Customer = require("../models/customer");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY: CUSTOMER_BODY,
  as,
  createCustomer,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/customers");

const BODY = {
  name: "Mayorista 30",
  description: "Margen del 30 % para mayoristas",
  percentage: 30,
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
  await resetDatabase();
  await sequelize.close();
});

describe("price lists CRUD with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a list and answers 201",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("post", "/price-lists", token).send(BODY);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: expect.any(Number),
        name: "Mayorista 30",
        description: "Margen del 30 % para mayoristas",
        percentage: 30,
      });

      const stored = await PriceList.findByPk(response.body.id);
      expect(Number(stored.percentage)).toBe(30);
    },
  );

  it("trims the text and stores a blank description as null", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/price-lists", token).send({
      name: "  Base 10  ",
      description: "   ",
      percentage: 10,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      name: "Base 10",
      description: null,
      percentage: 10,
    });
  });

  it("rejects a duplicated name ignoring case with 409", async () => {
    const token = await tokenFor("admin");
    await as("post", "/price-lists", token).send(BODY);

    const response = await as("post", "/price-lists", token).send({
      ...BODY,
      name: "mayorista 30",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Price list already exists" });
  });

  it.each([
    [100, "percentage must be < 100"],
    [-1, "Invalid percentage"],
    [12.345, "Invalid percentage"],
  ])("rejects percentage %p", async (percentage, message) => {
    const token = await tokenFor("admin");

    const response = await as("post", "/price-lists", token).send({
      ...BODY,
      percentage,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { percentage: message } });
  });

  it("lists the lists ordered by name and id", async () => {
    await PriceList.create({ name: "Mayorista 30", percentage: "30.00" });
    await PriceList.create({ name: "Base 10", percentage: "10.00" });
    const token = await tokenFor("seller");

    const response = await as("get", "/price-lists", token);

    expect(response.status).toBe(200);
    expect(response.body.map((list) => list.name)).toEqual([
      "Base 10",
      "Mayorista 30",
    ]);
  });

  it("returns one list and answers 422/404 for invalid and missing ids", async () => {
    const list = await PriceList.create({
      name: "Mayorista 30",
      percentage: "30.00",
    });
    const token = await tokenFor("admin");

    const found = await as("get", `/price-lists/${list.id}`, token);
    expect(found.status).toBe(200);
    expect(found.body.percentage).toBe(30);

    const invalid = await as("get", "/price-lists/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid price list id" },
    });

    const missing = await as("get", "/price-lists/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Price list not found" });
  });

  it("replaces a list with PUT and answers 202", async () => {
    const list = await PriceList.create({
      name: "Mayorista 30",
      description: "Anterior",
      percentage: "30.00",
    });
    const token = await tokenFor("seller");

    const response = await as("put", `/price-lists/${list.id}`, token).send({
      name: "Mayorista 35",
      percentage: 35,
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      id: list.id,
      name: "Mayorista 35",
      description: null,
      percentage: 35,
    });

    const stored = await PriceList.findByPk(list.id);
    expect(stored.name).toBe("Mayorista 35");
    expect(stored.description).toBeNull();
  });

  it("deletes an unused list and rejects a list assigned to a customer", async () => {
    const unused = await PriceList.create({
      name: "Base 10",
      percentage: "10.00",
    });
    const assigned = await PriceList.create({
      name: "Mayorista 30",
      percentage: "30.00",
    });
    await createCustomer({ price_list_id: assigned.id });
    const token = await tokenFor("admin");

    const deleted = await as("delete", `/price-lists/${unused.id}`, token);
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe("");
    await expect(PriceList.findByPk(unused.id)).resolves.toBeNull();

    const inUse = await as("delete", `/price-lists/${assigned.id}`, token);
    expect(inUse.status).toBe(409);
    expect(inUse.body).toEqual({ message: "Price list is in use" });
    await expect(PriceList.findByPk(assigned.id)).resolves.not.toBeNull();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 to a %s",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("get", "/price-lists", token);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 401 without a token", async () => {
    const response = await request(app).get("/price-lists");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});

describe("price list migration constraints with a real database", () => {
  it("rejects a percentage outside [0, 100) at the database level", async () => {
    await expect(
      PriceList.create({ name: "Fuera de rango", percentage: "100.00" }),
    ).rejects.toThrow();
  });

  it("rejects the same name ignoring case at the database level", async () => {
    await PriceList.create({ name: "Mayorista 30", percentage: "30.00" });

    await expect(
      PriceList.create({ name: "mayorista 30", percentage: "31.00" }),
    ).rejects.toThrow();
  });

  it("enforces the customer foreign key", async () => {
    await expect(
      Customer.create({ ...CUSTOMER_BODY, price_list_id: 99999 }),
    ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
  });
});
