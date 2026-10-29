process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const Customer = require("../models/customer");
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

describe("POST /customers with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a customer and answers 201",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("post", "/customers", token).send(BODY);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(PUBLIC_CUSTOMER);
      expect(response.body).not.toHaveProperty("isRegistered");
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");

      const stored = await Customer.findByPk(response.body.id);
      expect(Number(stored.latitude)).toBe(-17.7833);
      expect(Number(stored.longitude)).toBe(-63.1821);
      expect(stored.isRegistered).toBe(false);
    },
  );

  it("responds 401 without a token", async () => {
    const response = await request(app).post("/customers").send(BODY);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("post", "/customers", token).send(BODY);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 409 when the email already exists", async () => {
    await createCustomer();
    const token = await tokenFor("admin");

    const response = await as("post", "/customers", token).send(BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Customer already exists" });
  });

  it("responds 400 and 422 for missing and invalid fields", async () => {
    const token = await tokenFor("admin");

    const missing = await as("post", "/customers", token).send({
      fullName: "Juan Pérez",
    });
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message:
        "fullName, latitude, longitude, direction and email are required",
    });

    const invalid = await as("post", "/customers", token).send({
      ...BODY,
      latitude: 100,
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { latitude: "Latitud inválida" },
    });
  });

  it("responds 403 for a blocked user", async () => {
    const token = await tokenFor("admin");
    await User.update({ isBlocked: true }, { where: { username: "admin" } });

    const response = await as("get", "/customers", token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});

describe("GET /customers with a real database", () => {
  it("returns the customers ordered by id with public fields", async () => {
    const first = await createCustomer();
    const second = await createCustomer({
      fullName: "Ana Gómez",
      latitude: -17.79,
      longitude: -63.19,
      direction: "Calle 2 #45",
      email: "ana@example.com",
    });
    const token = await tokenFor("dispatcher");

    const response = await as("get", "/customers", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { ...PUBLIC_CUSTOMER, id: first.id },
      {
        id: second.id,
        fullName: "Ana Gómez",
        latitude: -17.79,
        longitude: -63.19,
        direction: "Calle 2 #45",
        email: "ana@example.com",
      },
    ]);
  });

  it("returns an empty array when there are no customers", async () => {
    const token = await tokenFor("admin");

    const response = await as("get", "/customers", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each(["manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("get", "/customers", token);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );
});

describe("GET /customers/:id with a real database", () => {
  it("returns one customer for the allowed roles", async () => {
    const customer = await createCustomer();
    const token = await tokenFor("seller");

    const response = await as("get", `/customers/${customer.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...PUBLIC_CUSTOMER, id: customer.id });
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("get", "/customers/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Customer not found" });

    const invalid = await as("get", "/customers/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid customer id" },
    });
  });
});

describe("PUT /customers/:id with a real database", () => {
  it("updates every public field and keeps the email unique", async () => {
    const customer = await createCustomer();
    const token = await tokenFor("admin");

    const response = await as("put", `/customers/${customer.id}`, token).send({
      fullName: "Juan Pérez Gómez",
      latitude: -17.79,
      longitude: -63.19,
      direction: "Av. Monseñor Rivero 456",
      email: "juan@example.com",
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      id: customer.id,
      fullName: "Juan Pérez Gómez",
      latitude: -17.79,
      longitude: -63.19,
      direction: "Av. Monseñor Rivero 456",
      email: "juan@example.com",
    });

    const stored = await Customer.findByPk(customer.id);
    expect(stored.fullName).toBe("Juan Pérez Gómez");
  });

  it("responds 409 when the email belongs to another customer", async () => {
    await createCustomer();
    const other = await createCustomer({
      email: "ana@example.com",
      fullName: "Ana Gómez",
    });
    const token = await tokenFor("seller");

    const response = await as("put", `/customers/${other.id}`, token).send({
      ...BODY,
      email: "juan@example.com",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Customer already exists" });
  });

  it("responds 404 for an unknown customer and 422 for an invalid id", async () => {
    const token = await tokenFor("admin");

    const missing = await as("put", "/customers/99999", token).send(BODY);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Customer not found" });

    const invalid = await as("put", "/customers/0", token).send(BODY);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid customer id" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const customer = await createCustomer();
    const token = await tokenFor("dispatcher");

    const response = await as("put", `/customers/${customer.id}`, token).send(
      BODY,
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
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
