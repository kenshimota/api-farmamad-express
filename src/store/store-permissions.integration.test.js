process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { createActor } = require("../../test/helpers/customer-sellers");
const {
  as,
  createAssignedSeller,
  createCustomer,
  createCustomerUser,
  createPriceList,
  createVariant,
  resetStoreDatabase,
} = require("../../test/helpers/store");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetStoreDatabase();
});

afterAll(async () => {
  await resetStoreDatabase();
  await sequelize.close();
});

/**
 * Creates a catalog with one available variant and a customer with a price
 * list.
 * @returns {Promise<object>} The product, customer and customer token.
 */
async function setupCatalog() {
  const variant = await createVariant();
  const priceList = await createPriceList();
  const customer = await createCustomer({ price_list_id: priceList.id });
  const customerActor = await createCustomerUser(customer);

  return {
    variant,
    customer,
    customerToken: customerActor.token,
    customerUser: customerActor.user,
  };
}

describe("store permissions with a real database", () => {
  it("rejects dispatcher, manager_warehouse and support with 403", async () => {
    const { variant } = await setupCatalog();
    const endpoints = [
      "/store/products",
      `/store/products/${variant.product.id}`,
    ];

    for (const role of ["dispatcher", "manager_warehouse", "support"]) {
      const { token } = await createActor(role);
      for (const endpoint of endpoints) {
        const response = await as("get", endpoint, token);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden" });
      }
    }
  });

  it("requires a token for both endpoints", async () => {
    const { variant } = await setupCatalog();

    for (const endpoint of [
      "/store/products",
      `/store/products/${variant.product.id}`,
    ]) {
      const response = await request(app).get(endpoint);
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: "Unauthorized" });
    }
  });

  it("requires customer_id for admin and seller on both endpoints", async () => {
    const { variant } = await setupCatalog();
    const admin = await createActor("admin");
    const seller = await createActor("seller");
    const endpoints = [
      "/store/products",
      `/store/products/${variant.product.id}`,
    ];

    for (const actor of [admin, seller]) {
      for (const endpoint of endpoints) {
        const response = await as("get", endpoint, actor.token);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "customer_id is required" });
      }
    }
  });

  it("lets an admin read any customer catalog with customer_id", async () => {
    const { customer, variant } = await setupCatalog();
    const { token } = await createActor("admin");

    const list = await as(
      "get",
      `/store/products?customer_id=${customer.id}`,
      token,
    );
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const detail = await as(
      "get",
      `/store/products/${variant.product.id}?customer_id=${customer.id}`,
      token,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe(variant.product.id);
  });

  it("rejects a seller assigned to another customer", async () => {
    const { variant } = await setupCatalog();
    const otherPriceList = await createPriceList();
    const other = await createCustomer({ price_list_id: otherPriceList.id });
    const { token } = await createActor("seller");
    const endpoints = [
      "/store/products",
      `/store/products/${variant.product.id}`,
    ];

    for (const endpoint of endpoints) {
      const response = await as(
        "get",
        `${endpoint}?customer_id=${other.id}`,
        token,
      );
      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: "Customer is not assigned to this seller",
      });
    }
  });

  it("lets an assigned seller read the customer catalog", async () => {
    const { customer, variant } = await setupCatalog();
    const { token } = await createAssignedSeller(customer);

    const list = await as(
      "get",
      `/store/products?customer_id=${customer.id}`,
      token,
    );
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const detail = await as(
      "get",
      `/store/products/${variant.product.id}?customer_id=${customer.id}`,
      token,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.variants).toHaveLength(1);
  });

  it("rejects an unlinked customer profile", async () => {
    const { variant } = await setupCatalog();
    const { token } = await createActor("customer");
    const endpoints = [
      "/store/products",
      `/store/products/${variant.product.id}`,
    ];

    for (const endpoint of endpoints) {
      const response = await as("get", endpoint, token);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: "Customer profile is not linked",
      });
    }
  });

  it("rejects a customer without a price list", async () => {
    await createVariant();
    const customer = await createCustomer({ price_list_id: null });
    const { token } = await createCustomerUser(customer);

    const response = await as("get", "/store/products", token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: "Customer price list is not assigned",
    });
  });

  it("lets a customer read only their own catalog", async () => {
    const { customer, variant, customerToken } = await setupCatalog();
    const otherList = await createPriceList();
    const other = await createCustomer({ price_list_id: otherList.id });

    const own = await as("get", "/store/products", customerToken);
    expect(own.status).toBe(200);
    expect(own.body).toHaveLength(1);

    const ownWithId = await as(
      "get",
      `/store/products/${variant.product.id}?customer_id=${customer.id}`,
      customerToken,
    );
    expect(ownWithId.status).toBe(200);

    const otherListResponse = await as(
      "get",
      `/store/products?customer_id=${other.id}`,
      customerToken,
    );
    expect(otherListResponse.status).toBe(403);
    expect(otherListResponse.body).toEqual({ message: "Forbidden" });
  });

  it("answers 403 to a blocked user", async () => {
    const { customerUser, customerToken } = await setupCatalog();

    await customerUser.update({ isBlocked: true });

    const response = await as("get", "/store/products", customerToken);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});
