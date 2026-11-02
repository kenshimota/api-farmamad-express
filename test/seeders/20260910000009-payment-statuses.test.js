const seeder = require("../../seeders/20260910000009-payment-statuses");

/**
 * Builds a query interface double that remembers inserted codes.
 * @param {string[]} existing - Codes already present.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble(existing = []) {
  return {
    rawSelect: jest.fn((table, options) =>
      existing.includes(options.where.code) ? 1 : undefined,
    ),
    bulkInsert: jest.fn(),
    bulkDelete: jest.fn(),
  };
}

describe("payment statuses seeder", () => {
  it("exposes the three base statuses", () => {
    expect(seeder.BASE_STATUSES.map((status) => status.code)).toEqual([
      "pending",
      "conciliated",
      "rejected",
    ]);
  });

  it("inserts the missing statuses idempotently", async () => {
    const query = queryInterfaceDouble(["pending"]);

    await seeder.up(query);

    expect(query.bulkInsert).toHaveBeenCalledTimes(2);
    expect(query.bulkInsert).toHaveBeenCalledWith("payment_statuses", [
      expect.objectContaining({ code: "conciliated" }),
    ]);
    expect(query.bulkInsert).toHaveBeenCalledWith("payment_statuses", [
      expect.objectContaining({ code: "rejected" }),
    ]);
  });

  it("does nothing when every status already exists", async () => {
    const query = queryInterfaceDouble(["pending", "conciliated", "rejected"]);

    await seeder.up(query);

    expect(query.bulkInsert).not.toHaveBeenCalled();
  });

  it("deletes the base statuses on down", async () => {
    const query = queryInterfaceDouble();

    await seeder.down(query);

    expect(query.bulkDelete).toHaveBeenCalledWith("payment_statuses", {
      code: ["pending", "conciliated", "rejected"],
    });
  });
});
