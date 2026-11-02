process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const OrderStatus = require("../models/order-status");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  resetDatabase,
  sessionFor,
  unique,
} = require("../../test/helpers/orders");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterEach(async () => {
  await OrderStatus.destroy({ where: { is_system: false } });
});

afterAll(async () => {
  await sequelize.close();
});

describe("order statuses CRUD with a real database", () => {
  it("lists the five base statuses ordered by sort_order", async () => {
    const { token } = await sessionFor("customer");

    const response = await as("get", "/order-statuses", token);

    expect(response.status).toBe(200);
    expect(response.body.map((status) => status.code)).toEqual([
      "draft",
      "request",
      "generate",
      "invoiced",
      "cancelled",
    ]);
    expect(response.body[0]).toEqual({
      id: expect.any(Number),
      code: "draft",
      name: "Borrador",
      description: null,
      sort_order: 10,
      next_status_code: "request",
      is_terminal: false,
      is_system: true,
    });
    expect(response.body[3]).toMatchObject({
      code: "invoiced",
      next_status_code: null,
      is_terminal: true,
    });
  });

  it("creates an additional status, splices it and deletes it when unused", async () => {
    const { token } = await sessionFor("admin");
    const code = unique("hold").toLowerCase().slice(0, 20);

    const created = await as("post", "/order-statuses", token).send({
      code,
      name: "En espera",
      description: "Esperando confirmación",
      sort_order: 25,
      next_status_code: "generate",
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      code,
      next_status_code: "generate",
      is_terminal: false,
      is_system: false,
    });

    const request = await OrderStatus.findOne({ where: { code: "request" } });
    const updated = await as(
      "put",
      `/order-statuses/${request.id}`,
      token,
    ).send({ next_status_code: code });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      code: "request",
      next_status_code: code,
      is_system: true,
    });

    await as("put", `/order-statuses/${request.id}`, token).send({
      next_status_code: "generate",
    });

    const removed = await as(
      "delete",
      `/order-statuses/${created.body.id}`,
      token,
    );
    expect(removed.status).toBe(204);
  });

  it("protects system statuses and rejects cycles", async () => {
    const { token } = await sessionFor("admin");
    const draft = await OrderStatus.findOne({ where: { code: "draft" } });

    const system = await as("delete", `/order-statuses/${draft.id}`, token);
    expect(system.status).toBe(409);
    expect(system.body).toEqual({
      message: "System order status cannot be deleted",
    });

    const request = await OrderStatus.findOne({ where: { code: "request" } });
    const cycle = await as("put", `/order-statuses/${request.id}`, token).send({
      next_status_code: "draft",
    });
    expect(cycle.status).toBe(422);
    expect(cycle.body).toEqual({
      errors: { next_status_code: "Status transition creates a cycle" },
    });
  });

  it("rejects writes from non-admin roles", async () => {
    const { token } = await sessionFor("seller");

    const response = await as("post", "/order-statuses", token).send({
      code: "blocked",
      name: "Bloqueado",
      sort_order: 60,
    });

    expect(response.status).toBe(403);
  });
});
