const {
  PAYMENT_STATUS,
  PAYMENT_STATUS_CODES,
  PAYMENT_STATUS_NAMES,
  PAYMENT_STATUS_TRANSITIONS,
  canTransition,
} = require("./statuses");

describe("payment statuses", () => {
  it("exposes the three base codes and their Spanish names", () => {
    expect(PAYMENT_STATUS_CODES).toEqual([
      "pending",
      "conciliated",
      "rejected",
    ]);
    expect(PAYMENT_STATUS).toEqual({
      PENDING: "pending",
      CONCILIATED: "conciliated",
      REJECTED: "rejected",
    });
    expect(PAYMENT_STATUS_NAMES).toEqual({
      pending: "Pendiente",
      conciliated: "Conciliado",
      rejected: "Rechazado",
    });
  });

  it("only allows the two pending transitions", () => {
    expect(PAYMENT_STATUS_TRANSITIONS.pending).toEqual([
      "conciliated",
      "rejected",
    ]);
    expect(canTransition("pending", "conciliated")).toBe(true);
    expect(canTransition("pending", "rejected")).toBe(true);
    expect(canTransition("conciliated", "conciliated")).toBe(false);
    expect(canTransition("conciliated", "rejected")).toBe(false);
    expect(canTransition("rejected", "conciliated")).toBe(false);
    expect(canTransition("unknown", "pending")).toBe(false);
  });
});
