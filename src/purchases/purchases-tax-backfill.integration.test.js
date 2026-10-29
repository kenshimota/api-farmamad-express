process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const { QueryTypes, Sequelize } = require("sequelize");
const sequelize = require("../database");
const migration = require("../../migrations/20260910000030-add-tax-amount-to-purchase-items");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  ensureDefaultTransactionCurrency,
} = require("../../test/helpers/currency-default");
const { createProduct } = require("../../test/helpers/products");
const { createItemState } = require("../../test/helpers/item-states");
const {
  createPurchaseSupplier,
  resetDatabase,
} = require("../../test/helpers/purchases");

const CHECK_NAME = "purchase_items_tax_amount_non_negative";

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

/**
 * Reads the names of the check constraints of a table.
 * @param {string} table - Table name.
 * @returns {Promise<string[]>} Constraint names.
 */
async function checkConstraints(table) {
  const rows = await sequelize.query(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = '${table}'::regclass AND contype = 'c'`,
    { type: QueryTypes.SELECT },
  );

  return rows.map((row) => row.conname);
}

describe("tax backfill migration against a real database", () => {
  it("spreads the historical tax, recalculates the totals and enforces the check", async () => {
    const queryInterface = sequelize.getQueryInterface();
    const suffix = Math.random().toString(36).slice(2, 8);
    const supplier = await createPurchaseSupplier();
    const product = await createProduct({ reference: `TAX-${suffix}` });
    const itemState = await createItemState({
      name: `tax_state_${suffix}`,
      label: `Estado ${suffix}`,
    });
    const negativeState = await createItemState({
      name: `tax_state_${suffix}_negative`,
      label: `Estado ${suffix} negativo`,
    });
    const currency = await ensureDefaultTransactionCurrency();
    const now = new Date();

    await migration.down(queryInterface, Sequelize);

    try {
      await queryInterface.bulkInsert("purchases", [
        {
          number: 9001,
          supplier_id: supplier.id,
          currency_id: currency.id,
          status: "confirmed",
          subtotal: "100.00",
          tax_rate: "10.00",
          tax_amount: "10.00",
          total: "110.00",
          notes: null,
          confirmed_at: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          number: 9002,
          supplier_id: supplier.id,
          currency_id: currency.id,
          status: "draft",
          subtotal: "0.00",
          tax_rate: "100.00",
          tax_amount: "5.00",
          total: "5.00",
          notes: null,
          confirmed_at: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          number: 9003,
          supplier_id: supplier.id,
          currency_id: currency.id,
          status: "draft",
          subtotal: "50.00",
          tax_rate: "10.00",
          tax_amount: "5.00",
          total: "55.00",
          notes: null,
          confirmed_at: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const purchases = await sequelize.query(
        "SELECT id, number FROM purchases WHERE number BETWEEN 9001 AND 9003 ORDER BY number",
        { type: QueryTypes.SELECT },
      );

      await queryInterface.bulkInsert("purchase_items", [
        {
          purchase_id: purchases[0].id,
          product_id: product.id,
          item_state_id: itemState.id,
          quantity: 1,
          unit_cost: "33.33",
          subtotal: "33.33",
          createdAt: now,
          updatedAt: now,
        },
        {
          purchase_id: purchases[0].id,
          product_id: product.id,
          item_state_id: (
            await createItemState({
              name: `tax_state_${suffix}_b`,
              label: `Estado ${suffix} B`,
            })
          ).id,
          quantity: 2,
          unit_cost: "33.335",
          subtotal: "66.67",
          createdAt: now,
          updatedAt: now,
        },
        {
          purchase_id: purchases[1].id,
          product_id: product.id,
          item_state_id: (
            await createItemState({
              name: `tax_state_${suffix}_c`,
              label: `Estado ${suffix} C`,
            })
          ).id,
          quantity: 1,
          unit_cost: "0.00",
          subtotal: "0.00",
          createdAt: now,
          updatedAt: now,
        },
        {
          purchase_id: purchases[1].id,
          product_id: product.id,
          item_state_id: (
            await createItemState({
              name: `tax_state_${suffix}_d`,
              label: `Estado ${suffix} D`,
            })
          ).id,
          quantity: 1,
          unit_cost: "0.00",
          subtotal: "0.00",
          createdAt: now,
          updatedAt: now,
        },
      ]);
    } finally {
      await migration.up(queryInterface, Sequelize);
    }

    const lines = await sequelize.query(
      `SELECT pi.id, pi.purchase_id, pi.subtotal, pi.tax_amount
       FROM purchase_items pi
       JOIN purchases p ON p.id = pi.purchase_id
       WHERE p.number BETWEEN 9001 AND 9003
       ORDER BY pi.id`,
      { type: QueryTypes.SELECT },
    );
    const firstPurchaseLines = lines.filter(
      (line) => line.purchase_id === lines[0].purchase_id,
    );

    expect(firstPurchaseLines.map((line) => Number(line.tax_amount))).toEqual([
      3.33, 6.67,
    ]);

    const headers = await sequelize.query(
      `SELECT number, subtotal, tax_amount, total FROM purchases
       WHERE number BETWEEN 9001 AND 9003 ORDER BY number`,
      { type: QueryTypes.SELECT },
    );

    expect(headers).toEqual([
      {
        number: 9001,
        subtotal: "100.00",
        tax_amount: "10.00",
        total: "110.00",
      },
      {
        number: 9002,
        subtotal: "0.00",
        tax_amount: "5.00",
        total: "5.00",
      },
      {
        number: 9003,
        subtotal: "0.00",
        tax_amount: "0.00",
        total: "0.00",
      },
    ]);

    const purchaseColumns = await queryInterface.describeTable("purchases");

    expect(purchaseColumns).not.toHaveProperty("tax_rate");
    expect(await checkConstraints("purchase_items")).toContain(CHECK_NAME);

    await expect(
      queryInterface.bulkInsert("purchase_items", [
        {
          purchase_id: lines[0].purchase_id,
          product_id: product.id,
          item_state_id: negativeState.id,
          quantity: 1,
          unit_cost: "1.00",
          subtotal: "1.00",
          tax_amount: "-1.00",
          createdAt: now,
          updatedAt: now,
        },
      ]),
    ).rejects.toThrow();
  });
});
