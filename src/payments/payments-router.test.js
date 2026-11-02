const {
  PAYMENT,
  paymentService,
  send,
  tokenFor,
  userFor,
} = require("../../test/helpers/payments-router-support");
const User = require("../models/user");
const { resolveListQuery } = require("./list");

describe("GET /payments", () => {
  it("lists payments for staff applying the filters", async () => {
    const response = await send(
      "get",
      "/payments?customer_id=8&method_payment_id=3&currency_id=2&paid_from=2026-11-01&paid_to=2026-11-02",
      undefined,
      tokenFor("seller"),
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ id: 1, amount: 100 });
    expect(paymentService.listPayments).toHaveBeenCalledWith({
      customerId: 8,
      methodPaymentId: 3,
      currencyId: 2,
      paidFrom: new Date("2026-11-01T00:00:00.000Z"),
      paidTo: new Date("2026-11-03T00:00:00.000Z"),
    });
  });

  it.each(["customer", "dispatcher"])("responds 403 for %s", async (role) => {
    User.findByPk.mockResolvedValue(userFor(role));

    const response = await send("get", "/payments", undefined, tokenFor(role));

    expect(response.status).toBe(403);
    expect(paymentService.listPayments).not.toHaveBeenCalled();
  });

  it.each([
    ["customer_id=abc", "customer_id"],
    ["method_payment_id=0", "method_payment_id"],
    ["currency_id=-1", "currency_id"],
    ["paid_from=2026-13-01", "paid_from"],
    ["paid_to=01-11-2026", "paid_to"],
  ])("responds 422 for the filter %s", async (query, field) => {
    const response = await send("get", `/payments?${query}`);

    expect(response.status).toBe(422);
    expect(response.body.errors).toHaveProperty(field);
    expect(paymentService.listPayments).not.toHaveBeenCalled();
  });

  it("resolves an empty query to empty filters", () => {
    expect(resolveListQuery({})).toEqual({ filters: {} });
  });

  it("forwards the optional status filter", async () => {
    const response = await send(
      "get",
      "/payments?status=conciliated",
      undefined,
      tokenFor("seller"),
    );

    expect(response.status).toBe(200);
    expect(paymentService.listPayments).toHaveBeenCalledWith({
      status: "conciliated",
    });
  });

  it.each(["pending", "conciliated", "rejected"])(
    "accepts the status filter %s",
    (status) => {
      expect(resolveListQuery({ status })).toEqual({
        filters: { status },
      });
    },
  );

  it("responds 422 for an unknown status filter", () => {
    expect(resolveListQuery({ status: "other" })).toEqual({
      errors: { status: "Invalid status" },
    });
  });
});

describe("GET /payments/:id", () => {
  it("returns the payment to the customer owner", async () => {
    User.findByPk.mockResolvedValue(userFor("customer"));

    const response = await send(
      "get",
      "/payments/1",
      undefined,
      tokenFor("customer"),
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 1, amount: 100 });
  });

  it("hides another customer's payment with 404", async () => {
    User.findByPk.mockResolvedValue(userFor("customer"));
    paymentService.getPayment.mockResolvedValue({
      ...PAYMENT,
      customer_id: 9,
    });

    const hidden = await send(
      "get",
      "/payments/1",
      undefined,
      tokenFor("customer"),
    );

    expect(hidden.status).toBe(404);
    expect(hidden.body).toEqual({ message: "Payment not found" });
  });

  it("responds 403 when the customer profile is not linked", async () => {
    User.findByPk.mockResolvedValue(userFor("customer", { customer_id: null }));

    const response = await send(
      "get",
      "/payments/1",
      undefined,
      tokenFor("customer"),
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: "Customer profile is not linked",
    });
  });

  it.each(["abc", "0", "1.5"])("responds 422 for the id %s", async (id) => {
    const response = await send("get", `/payments/${id}`);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid payment id" } });
  });

  it("responds 404 for an unknown payment", async () => {
    paymentService.getPayment.mockResolvedValue(null);

    const response = await send("get", "/payments/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Payment not found" });
  });
});

describe("PUT /payments/:id", () => {
  it("updates metadata and responds 202", async () => {
    const response = await send("put", "/payments/1", {
      reference: "  TRX-456  ",
      notes: "  nota  ",
    });

    expect(response.status).toBe(202);
    expect(paymentService.updatePayment).toHaveBeenCalledWith(PAYMENT, {
      reference: "TRX-456",
      notes: "nota",
    });
  });

  it("responds 400 without fields", async () => {
    const response = await send("put", "/payments/1", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "At least one field is required",
    });
  });

  it("rejects an immutable change and allocations", async () => {
    const immutable = Object.assign(new Error("immutable"), {
      status: 422,
      body: { errors: { amount: "amount cannot be changed" } },
    });
    paymentService.updatePayment.mockRejectedValueOnce(immutable);

    const response = await send("put", "/payments/1", { amount: 99 });
    expect(response.status).toBe(422);

    const allocations = Object.assign(new Error("allocations"), {
      status: 409,
      body: { message: "Payment has allocations" },
    });
    paymentService.updatePayment.mockRejectedValueOnce(allocations);

    const conflict = await send("put", "/payments/1", { notes: "x" });
    expect(conflict.status).toBe(409);
  });

  it("responds 403 to a customer", async () => {
    User.findByPk.mockResolvedValue(userFor("customer"));

    const response = await send(
      "put",
      "/payments/1",
      { notes: "x" },
      tokenFor("customer"),
    );

    expect(response.status).toBe(403);
  });
});
