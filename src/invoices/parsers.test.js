const {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_MESSAGE,
  parseCustomerFilter,
  parseInvoiceId,
  parseNumberFilter,
  parseOrderFilter,
  parsePaymentStatusFilter,
} = require("./parsers");

describe("invoice parsers", () => {
  it("exposes the documented payment statuses and message", () => {
    expect(PAYMENT_STATUSES).toEqual(["pending", "partial", "paid"]);
    expect(PAYMENT_STATUS_MESSAGE).toBe("Invalid payment status");
  });

  it.each([
    [1, 1],
    ["1", 1],
    [" 42 ", 42],
    [0, null],
    [-1, null],
    [1.5, null],
    ["abc", null],
    ["", null],
    [null, null],
    [undefined, null],
    [{}, null],
  ])("parses invoice id %p as %p", (value, expected) => {
    expect(parseInvoiceId(value)).toBe(expected);
  });

  it("parses the optional exact filters", () => {
    expect(parseOrderFilter("10")).toBe(10);
    expect(parseOrderFilter("0")).toBeNull();
    expect(parseCustomerFilter("8")).toBe(8);
    expect(parseCustomerFilter("x")).toBeNull();
    expect(parseNumberFilter("3")).toBe(3);
    expect(parseNumberFilter("-3")).toBeNull();
  });

  it.each(["pending", "partial", "paid", " paid "])(
    "accepts the payment status %p",
    (value) => {
      expect(parsePaymentStatusFilter(value)).toBe(value.trim());
    },
  );

  it.each(["cancelled", "", null, 1])(
    "rejects the payment status %p",
    (value) => {
      expect(parsePaymentStatusFilter(value)).toBeNull();
    },
  );
});
