const {
  PAYMENT,
  paymentService,
  send,
  tokenFor,
  userFor,
} = require("../../test/helpers/payments-router-support");
const User = require("../models/user");

describe("DELETE /payments/:id", () => {
  it("deletes and responds 204 for an admin", async () => {
    const response = await send("delete", "/payments/1");

    expect(response.status).toBe(204);
    expect(paymentService.deletePayment).toHaveBeenCalledWith(PAYMENT);
  });

  it("responds 403 for a seller", async () => {
    User.findByPk.mockResolvedValue(userFor("seller"));

    const response = await send(
      "delete",
      "/payments/1",
      undefined,
      tokenFor("seller"),
    );

    expect(response.status).toBe(403);
    expect(paymentService.deletePayment).not.toHaveBeenCalled();
  });

  it("forwards the allocations conflict", async () => {
    paymentService.deletePayment.mockRejectedValue(
      Object.assign(new Error("allocations"), {
        status: 409,
        body: { message: "Payment has allocations" },
      }),
    );

    const response = await send("delete", "/payments/1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment has allocations" });
  });
});
