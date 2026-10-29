const migration = require("../../migrations/20260910000030-add-tax-amount-to-purchase-items");

const TRANSACTION = { id: "transaction" };

/**
 * Builds the Sequelize type double used by the migration.
 * @returns {object} Sequelize double.
 */
function sequelizeDouble() {
  return {
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    Op: { gte: "GTE", between: "BETWEEN" },
  };
}

/**
 * Builds a query interface double backed by purchase and line rows.
 * @param {object} [options] - Initial rows.
 * @param {object[]} [options.purchases] - Purchase rows.
 * @param {object} [options.itemsByPurchase] - Lines keyed by purchase id.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble({ purchases = [], itemsByPurchase = {} } = {}) {
  return {
    sequelize: {
      transaction: jest.fn(async (callback) => callback(TRANSACTION)),
      query: jest.fn().mockResolvedValue([{}, 0]),
    },
    addColumn: jest.fn(),
    changeColumn: jest.fn(),
    removeColumn: jest.fn(),
    addConstraint: jest.fn(),
    removeConstraint: jest.fn(),
    bulkUpdate: jest.fn(),
    select: jest.fn(async (model, table, options) => {
      if (table === "purchases") {
        return purchases;
      }

      return itemsByPurchase[options.where.purchase_id] ?? [];
    }),
  };
}

describe("migration 20260910000030-add-tax-amount-to-purchase-items", () => {
  it("adds tax_amount as nullable before the backfill", async () => {
    const query = queryInterfaceDouble();

    await migration.up(query, sequelizeDouble());

    expect(query.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(query.addColumn).toHaveBeenCalledWith(
      "purchase_items",
      "tax_amount",
      { type: "DECIMAL(12,2)", allowNull: true },
      { transaction: TRANSACTION },
    );
  });

  it("spreads the historical tax proportionally with the remainder on the last line", async () => {
    const query = queryInterfaceDouble({
      purchases: [
        { id: 1, subtotal: "100.00", tax_amount: "10.00" },
        { id: 2, subtotal: "0.00", tax_amount: "5.00" },
      ],
      itemsByPurchase: {
        1: [
          { id: 10, subtotal: "33.33" },
          { id: 11, subtotal: "66.67" },
        ],
        2: [
          { id: 20, subtotal: "0.00" },
          { id: 21, subtotal: "0.00" },
        ],
      },
    });

    await migration.up(query, sequelizeDouble());

    expect(query.bulkUpdate).toHaveBeenCalledWith(
      "purchase_items",
      { tax_amount: "3.33" },
      { id: 10 },
      { transaction: TRANSACTION },
    );
    expect(query.bulkUpdate).toHaveBeenCalledWith(
      "purchase_items",
      { tax_amount: "6.67" },
      { id: 11 },
      { transaction: TRANSACTION },
    );
    expect(query.bulkUpdate).toHaveBeenCalledWith(
      "purchase_items",
      { tax_amount: "0.00" },
      { id: 20 },
      { transaction: TRANSACTION },
    );
    expect(query.bulkUpdate).toHaveBeenCalledWith(
      "purchase_items",
      { tax_amount: "5.00" },
      { id: 21 },
      { transaction: TRANSACTION },
    );
  });

  it("recalculates every purchase from its lines, even when it has none", async () => {
    const query = queryInterfaceDouble({
      purchases: [
        { id: 1, subtotal: "100.00", tax_amount: "10.00" },
        { id: 2, subtotal: "0.00", tax_amount: "5.00" },
        { id: 3, subtotal: "50.00", tax_amount: "0.00" },
      ],
      itemsByPurchase: {
        1: [
          { id: 10, subtotal: "33.33" },
          { id: 11, subtotal: "66.67" },
        ],
        2: [{ id: 20, subtotal: "0.00" }],
        3: [],
      },
    });

    await migration.up(query, sequelizeDouble());

    expect(query.bulkUpdate).toHaveBeenCalledWith(
      "purchases",
      { subtotal: "100.00", tax_amount: "10.00", total: "110.00" },
      { id: 1 },
      { transaction: TRANSACTION },
    );
    expect(query.bulkUpdate).toHaveBeenCalledWith(
      "purchases",
      { subtotal: "0.00", tax_amount: "5.00", total: "5.00" },
      { id: 2 },
      { transaction: TRANSACTION },
    );
    expect(query.bulkUpdate).toHaveBeenCalledWith(
      "purchases",
      { subtotal: "0.00", tax_amount: "0.00", total: "0.00" },
      { id: 3 },
      { transaction: TRANSACTION },
    );
  });

  it("requires the column, adds the check and removes the old tax_rate", async () => {
    const query = queryInterfaceDouble();

    await migration.up(query, sequelizeDouble());

    expect(query.changeColumn).toHaveBeenCalledWith(
      "purchase_items",
      "tax_amount",
      { type: "DECIMAL(12,2)", allowNull: false, defaultValue: 0 },
      { transaction: TRANSACTION },
    );
    expect(query.addConstraint).toHaveBeenCalledWith("purchase_items", {
      fields: ["tax_amount"],
      type: "check",
      name: "purchase_items_tax_amount_non_negative",
      where: { tax_amount: { GTE: 0 } },
      transaction: TRANSACTION,
    });
    expect(query.removeConstraint).toHaveBeenCalledWith(
      "purchases",
      "purchases_tax_rate_range",
      { transaction: TRANSACTION },
    );
    expect(query.removeColumn).toHaveBeenCalledWith("purchases", "tax_rate", {
      transaction: TRANSACTION,
    });
  });

  it("restores tax_rate with the effective rate and drops the line tax on rollback", async () => {
    const query = queryInterfaceDouble();

    await migration.down(query, sequelizeDouble());

    expect(query.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(query.addColumn).toHaveBeenCalledWith(
      "purchases",
      "tax_rate",
      { type: "DECIMAL(5,2)", allowNull: true },
      { transaction: TRANSACTION },
    );
    expect(query.sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining("tax_amount / subtotal * 100"),
      { transaction: TRANSACTION },
    );
    expect(query.changeColumn).toHaveBeenCalledWith(
      "purchases",
      "tax_rate",
      { type: "DECIMAL(5,2)", allowNull: false, defaultValue: 16 },
      { transaction: TRANSACTION },
    );
    expect(query.addConstraint).toHaveBeenCalledWith("purchases", {
      fields: ["tax_rate"],
      type: "check",
      name: "purchases_tax_rate_range",
      where: { tax_rate: { BETWEEN: [0, 100] } },
      transaction: TRANSACTION,
    });
    expect(query.removeConstraint).toHaveBeenCalledWith(
      "purchase_items",
      "purchase_items_tax_amount_non_negative",
      { transaction: TRANSACTION },
    );
    expect(query.removeColumn).toHaveBeenCalledWith(
      "purchase_items",
      "tax_amount",
      { transaction: TRANSACTION },
    );
  });
});

describe("allocateTaxCents", () => {
  it("splits proportionally and keeps the exact total", () => {
    expect(migration.allocateTaxCents(1000, [3333, 6667])).toEqual([333, 667]);
  });

  it("gives every cent to the last line when the subtotal is zero", () => {
    expect(migration.allocateTaxCents(500, [0, 0])).toEqual([0, 500]);
  });

  it("returns an empty allocation without lines", () => {
    expect(migration.allocateTaxCents(500, [])).toEqual([]);
  });
});
