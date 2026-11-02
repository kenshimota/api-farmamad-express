const {
  paymentService,
  send,
  tokenFor,
  userFor,
} = require("../../test/helpers/payments-router-support");
const User = require("../models/user");

describe("POST /payments", () => {
  it("creates the payment and responds 201 with the credited wallet", async () => {
    const response = await send(
      "post",
      "/payments",
      {
        customer_id: 8,
        method_payment_id: 3,
        amount: 100,
        currency_id: 99,
        reference: "  TRX-123  ",
        notes: "  Depósito  ",
      },
      tokenFor("seller"),
    );

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: 1,
      amount: 100,
      wallet: { id: 5, balance: 100 },
    });
    expect(paymentService.createPayment).toHaveBeenCalledWith(
      {
        customer_id: 8,
        method_payment_id: 3,
        amount: 100,
        reference: "TRX-123",
        notes: "Depósito",
      },
      1,
    );
  });

  it("responds 400 when a required field is missing", async () => {
    const response = await send("post", "/payments", {
      customer_id: 8,
      amount: 100,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "customer_id, method_payment_id and amount are required",
    });
    expect(paymentService.createPayment).not.toHaveBeenCalled();
  });

  it.each([
    [{ amount: 0 }],
    [{ amount: -5 }],
    [{ amount: 1.234 }],
    [{ amount: "abc" }],
  ])("responds 422 for the amount %p", async (overrides) => {
    const response = await send("post", "/payments", {
      customer_id: 8,
      method_payment_id: 3,
      amount: 100,
      ...overrides,
    });

    expect(response.status).toBe(422);
    expect(response.body.errors).toHaveProperty("amount");
  });

  it.each(["customer", "dispatcher", "support"])(
    "responds 403 for %s",
    async (role) => {
      User.findByPk.mockResolvedValue(userFor(role));

      const response = await send(
        "post",
        "/payments",
        { customer_id: 8, method_payment_id: 3, amount: 100 },
        tokenFor(role),
      );

      expect(response.status).toBe(403);
    },
  );

  it("responds 401 without a token", async () => {
    const response = await send(
      "post",
      "/payments",
      { customer_id: 8, method_payment_id: 3, amount: 100 },
      null,
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("forwards the service HTTP errors", async () => {
    const error = Object.assign(new Error("missing"), {
      status: 404,
      body: { message: "Customer not found" },
    });
    paymentService.createPayment.mockRejectedValue(error);

    const response = await send("post", "/payments", {
      customer_id: 99,
      method_payment_id: 3,
      amount: 100,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Customer not found" });
  });

  it("forwards unexpected errors as 500", async () => {
    paymentService.createPayment.mockRejectedValue(new Error("db down"));

    const response = await send("post", "/payments", {
      customer_id: 8,
      method_payment_id: 3,
      amount: 100,
    });

    expect(response.status).toBe(500);
  });
});
