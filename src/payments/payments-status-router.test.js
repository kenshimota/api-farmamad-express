const {
  PAYMENT,
  WALLET,
  paymentStatusService,
  send,
  tokenFor,
  userFor,
} = require("../../test/helpers/payments-router-support");
const User = require("../models/user");

describe("PUT /payments/:id/status", () => {
  it("conciliates a payment and responds 202 with the wallet", async () => {
    const response = await send(
      "put",
      "/payments/1/status",
      { status: "conciliated", reason: "  Banco verificado  " },
      tokenFor("seller"),
    );

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      id: 1,
      status: "conciliated",
      wallet: { id: WALLET.id, balance: 100 },
    });
    expect(paymentStatusService.changeStatus).toHaveBeenCalledWith(
      PAYMENT.id,
      { status: "conciliated", reason: "Banco verificado" },
      1,
    );
  });

  it("responds 400 without status and 422 for an invalid status", async () => {
    const missing = await send(
      "put",
      "/payments/1/status",
      { reason: "x" },
      tokenFor("admin"),
    );
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ message: "status is required" });

    const invalid = await send(
      "put",
      "/payments/1/status",
      { status: "pending" },
      tokenFor("admin"),
    );
    expect(invalid.status).toBe(422);
    expect(invalid.body.errors).toHaveProperty("status");
  });

  it("requires a reason when rejecting", async () => {
    const response = await send(
      "put",
      "/payments/1/status",
      { status: "rejected", reason: "  x " },
      tokenFor("admin"),
    );

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { reason: "reason is required when the payment is rejected" },
    });
    expect(paymentStatusService.changeStatus).not.toHaveBeenCalled();
  });

  it("forwards invalid transitions and terminal states", async () => {
    paymentStatusService.changeStatus.mockRejectedValueOnce(
      Object.assign(new Error("transition"), {
        status: 422,
        body: { errors: { status: "Invalid status transition" } },
      }),
    );

    const response = await send(
      "put",
      "/payments/1/status",
      { status: "rejected", reason: "Motivo válido" },
      tokenFor("admin"),
    );

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { status: "Invalid status transition" },
    });
  });

  it("responds 403 to a customer", async () => {
    User.findByPk.mockResolvedValue(userFor("customer"));

    const response = await send(
      "put",
      "/payments/1/status",
      { status: "conciliated" },
      tokenFor("customer"),
    );

    expect(response.status).toBe(403);
  });
});

describe("GET /payments/:id/history", () => {
  it("returns the events with actor for staff", async () => {
    const response = await send(
      "get",
      "/payments/1/history",
      undefined,
      tokenFor("seller"),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 1,
        from_status: null,
        to_status: "pending",
        reason: null,
        created_at: "2026-11-01T12:00:00.000Z",
        actor: { id: 1, username: "user", email: "user@farmamad.com" },
      },
    ]);
  });

  it("responds 403 for a customer", async () => {
    User.findByPk.mockResolvedValue(userFor("customer"));

    const response = await send(
      "get",
      "/payments/1/history",
      undefined,
      tokenFor("customer"),
    );

    expect(response.status).toBe(403);
    expect(paymentStatusService.listHistory).not.toHaveBeenCalled();
  });

  it("responds 404 for an unknown payment", async () => {
    const {
      paymentService,
    } = require("../../test/helpers/payments-router-support");
    paymentService.getPayment.mockResolvedValue(null);

    const response = await send(
      "get",
      "/payments/999/history",
      undefined,
      tokenFor("admin"),
    );

    expect(response.status).toBe(404);
  });
});
