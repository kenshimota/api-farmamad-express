process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const PriceList = require("../models/price-list");
const Customer = require("../models/customer");
const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  PUBLIC_CUSTOMER,
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

describe("price list assignment with a real database", () => {
  it("assigns a price list on POST and exposes only its id and name", async () => {
    const priceList = await PriceList.create({
      name: "Mayorista 30",
      description: "Margen interno",
      percentage: "30.00",
    });
    const token = await tokenFor("admin");

    const response = await as("post", "/customers", token).send({
      ...BODY,
      price_list_id: priceList.id,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      ...PUBLIC_CUSTOMER,
      price_list_id: priceList.id,
      price_list: { id: priceList.id, name: "Mayorista 30" },
    });
    expect(response.body.price_list).not.toHaveProperty("percentage");
    expect(response.body.price_list).not.toHaveProperty("description");

    const stored = await Customer.findByPk(response.body.id);
    expect(stored.price_list_id).toBe(priceList.id);
  });

  it("replaces, keeps and clears the price list on PUT", async () => {
    const first = await PriceList.create({
      name: "Mayorista 30",
      percentage: "30.00",
    });
    const second = await PriceList.create({
      name: "Mayorista 35",
      percentage: "35.00",
    });
    const customer = await createCustomer({ price_list_id: first.id });
    const token = await tokenFor("seller");

    const replaced = await as("put", `/customers/${customer.id}`, token).send({
      ...BODY,
      price_list_id: second.id,
    });
    expect(replaced.status).toBe(202);
    expect(replaced.body.price_list_id).toBe(second.id);
    expect(replaced.body.price_list).toEqual({
      id: second.id,
      name: "Mayorista 35",
    });

    const kept = await as("put", `/customers/${customer.id}`, token).send(BODY);
    expect(kept.status).toBe(202);
    expect(kept.body.price_list_id).toBe(second.id);

    const cleared = await as("put", `/customers/${customer.id}`, token).send({
      ...BODY,
      price_list_id: null,
    });
    expect(cleared.status).toBe(202);
    expect(cleared.body.price_list_id).toBeNull();
    expect(cleared.body.price_list).toBeNull();

    const stored = await Customer.findByPk(customer.id);
    expect(stored.price_list_id).toBeNull();
  });

  it("responds 422 for a non-existent price list", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/customers", token).send({
      ...BODY,
      price_list_id: 99999,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { price_list_id: "Invalid price list" },
    });
    await expect(Customer.count()).resolves.toBe(0);
  });
});
