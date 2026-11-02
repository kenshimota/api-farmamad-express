const {
  INVALID_STATUS_MESSAGE,
  REASON_MAX_MESSAGE,
  REASON_REQUIRED_MESSAGE,
  STATUS_REQUIRED_MESSAGE,
  changePaymentStatusSchema,
  normalizeReason,
} = require("./status-validators");

/**
 * Validates a status payload with the module defaults.
 * @param {object} body - Raw body.
 * @returns {Promise<object>} Validated values.
 */
function validate(body) {
  return changePaymentStatusSchema.validate(body, { stripUnknown: true });
}

describe("changePaymentStatusSchema", () => {
  it("accepts a conciliated status with an optional trimmed reason", async () => {
    await expect(
      validate({ status: "conciliated", reason: "  Verificado  " }),
    ).resolves.toEqual({
      status: "conciliated",
      reason: "Verificado",
    });

    await expect(
      validate({ status: "conciliated", reason: "   " }),
    ).resolves.toEqual({ status: "conciliated", reason: null });
  });

  it("accepts a rejected status with a reason of at least three chars", async () => {
    await expect(
      validate({ status: "rejected", reason: "  No coincide  " }),
    ).resolves.toEqual({ status: "rejected", reason: "No coincide" });
  });

  it("rejects an unknown status", async () => {
    await expect(validate({ status: "pending" })).rejects.toThrow(
      INVALID_STATUS_MESSAGE,
    );
    await expect(validate({ status: "other" })).rejects.toThrow(
      INVALID_STATUS_MESSAGE,
    );
  });

  it("requires a status", async () => {
    await expect(validate({})).rejects.toThrow(STATUS_REQUIRED_MESSAGE);
  });

  it("requires a meaningful reason when rejecting", async () => {
    await expect(validate({ status: "rejected" })).rejects.toThrow(
      REASON_REQUIRED_MESSAGE,
    );
    await expect(
      validate({ status: "rejected", reason: "  ab  " }),
    ).rejects.toThrow(REASON_REQUIRED_MESSAGE);
  });

  it("rejects reasons longer than 500 characters", async () => {
    await expect(
      validate({ status: "conciliated", reason: "x".repeat(501) }),
    ).rejects.toThrow(REASON_MAX_MESSAGE);
  });

  it("normalizes blank and non-string reasons", () => {
    expect(normalizeReason("  hola  ")).toBe("hola");
    expect(normalizeReason("   ")).toBeNull();
    expect(normalizeReason(undefined)).toBeUndefined();
  });
});
