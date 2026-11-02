process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const sequelize = require("../database");
const app = require("../app");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createCustomer,
  createInvoice,
  createInvoiceItem,
  resetDatabase,
  sessionFor,
  tokenFor,
} = require("../../test/helpers/invoices");

const ISSUED_AT = new Date("2026-11-01T12:00:00.000Z");

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

describe("GET /invoices with a real database", () => {
  it("lists summaries ordered by issue date, filters and excludes lines", async () => {
    const session = await sessionFor("admin");
    const customer = await createCustomer();
    const first = await createInvoice({
      customer_id: customer.id,
      invoiced_by_user_id: session.user.id,
      issued_at: new Date("2026-11-01T10:00:00.000Z"),
    });
    const second = await createInvoice({
      customer_id: customer.id,
      invoiced_by_user_id: session.user.id,
      issued_at: new Date("2026-11-02T10:00:00.000Z"),
      order_id: 100,
      payment_status: "paid",
      paid_amount: 25,
    });
    await createInvoiceItem({ invoice_id: second.id });

    const list = await as("get", "/invoices", session.token);
    expect(list.status).toBe(200);
    expect(list.body.map((row) => row.id)).toEqual([second.id, first.id]);
    expect(list.body[0].items).toBeUndefined();
    expect(list.body[0].invoiced_by).toBeUndefined();
    expect(list.body[0]).toMatchObject({
      customer_id: customer.id,
      balance_due: 0,
      payment_status: "paid",
      order_id: 100,
    });
    expect(list.body[0].customer).toEqual(
      expect.objectContaining({ id: customer.id }),
    );
    expect(list.body[0]).not.toHaveProperty("createdAt");

    const byOrder = await as("get", "/invoices?order_id=100", session.token);
    expect(byOrder.body.map((row) => row.id)).toEqual([second.id]);

    const byCustomer = await as(
      "get",
      `/invoices?customer_id=${customer.id}`,
      session.token,
    );
    expect(byCustomer.body).toHaveLength(2);

    const byNumber = await as(
      "get",
      `/invoices?number=${first.number}`,
      session.token,
    );
    expect(byNumber.body.map((row) => row.id)).toEqual([first.id]);

    const byStatus = await as(
      "get",
      "/invoices?payment_status=paid",
      session.token,
    );
    expect(byStatus.body.map((row) => row.id)).toEqual([second.id]);
  });

  it.each([
    ["order_id=0", { order_id: "Invalid order id" }],
    ["customer_id=x", { customer_id: "Invalid customer id" }],
    ["number=abc", { number: "Invalid number" }],
    ["payment_status=cancelled", { payment_status: "Invalid payment status" }],
  ])("answers 422 for the filter %s", async (query, errors) => {
    const token = await tokenFor("admin");
    const response = await as("get", `/invoices?${query}`, token);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
  });

  it("requires a token and restricts the listing to admin and seller", async () => {
    const unauthenticated = await request(app).get("/invoices");
    expect(unauthenticated.status).toBe(401);

    for (const role of ["admin", "seller"]) {
      const token = await tokenFor(role);
      const response = await as("get", "/invoices", token);
      expect(response.status).toBe(200);
    }
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "answers 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);
      const response = await as("get", "/invoices", token);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );
});

describe("GET /invoices/:id with a real database", () => {
  it("returns the detail with lines and invoiced_by to admin and seller", async () => {
    const admin = await sessionFor("admin");
    const invoice = await createInvoice({
      invoiced_by_user_id: admin.user.id,
      issued_at: ISSUED_AT,
    });
    const item = await createInvoiceItem({ invoice_id: invoice.id });

    for (const role of ["admin", "seller"]) {
      const token = role === "admin" ? admin.token : await tokenFor("seller");
      const response = await as("get", `/invoices/${invoice.id}`, token);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: invoice.id,
        number: invoice.number,
        subtotal: 25,
        tax_amount: 0,
        total: 25,
        paid_amount: 0,
        balance_due: 25,
        payment_status: "pending",
        issued_at: ISSUED_AT.toISOString(),
        due_date: "2026-11-16",
      });
      expect(response.body.invoiced_by).toEqual(
        expect.objectContaining({ id: admin.user.id, username: "admin" }),
      );
      expect(response.body.items).toEqual([
        expect.objectContaining({
          order_item_id: null,
          product_id: item.product_id,
          product_name: item.product_name,
          product_reference: item.product_reference,
          item_state_name: item.item_state_name,
          quantity: 2,
          unit_price: 12.5,
          subtotal: 25,
        }),
      ]);
      expect(response.body.items[0]).not.toHaveProperty("createdAt");
    }
  });

  it("answers 403 for a customer without users.customer_id", async () => {
    const invoice = await createInvoice();
    const token = await tokenFor("customer");

    const response = await as("get", `/invoices/${invoice.id}`, token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: "Customer profile is not linked",
    });
  });

  it("answers 422 for an invalid id and 404 for a missing invoice", async () => {
    const token = await tokenFor("admin");

    const invalid = await as("get", "/invoices/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid invoice id" } });

    const missing = await as("get", "/invoices/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Invoice not found" });
  });
});
