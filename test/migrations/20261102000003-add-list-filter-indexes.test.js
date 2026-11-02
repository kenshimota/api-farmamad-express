const migration = require("../../migrations/20261102000003-add-list-filter-indexes");

const COLUMNS = {
  products: ["id", "category_id", "tax_id"],
  customers: ["id", "fullName"],
  suppliers: ["id", "state_id", "city_id"],
  orders: ["id", "customer_id", "status"],
  invoices: ["id", "customer_id", "order_id"],
  payments: ["id", "customer_id"],
  payment_allocations: ["id", "invoice_id"],
  lots: ["id", "product_id"],
  stocks: ["id", "product_id"],
};

/**
 * Builds the query interface double used by the migration.
 * @param {Map<string, object[]>} [indexes] - Existing indexes per table.
 * @returns {object} The query interface double.
 */
function setup(indexes = new Map()) {
  return {
    describeTable: jest.fn((table) =>
      Promise.resolve(
        Object.fromEntries(
          (COLUMNS[table] ?? []).map((column) => [column, {}]),
        ),
      ),
    ),
    showIndex: jest.fn((table) => Promise.resolve(indexes.get(table) ?? [])),
    addIndex: jest.fn(),
    removeIndex: jest.fn(),
    sequelize: {
      transaction: jest.fn((callback) => callback("transaction")),
    },
  };
}

describe("migration 20261102000003-add-list-filter-indexes", () => {
  it("creates only the indexes that are missing and whose columns exist", async () => {
    const queryInterface = setup();

    await migration.up(queryInterface);

    const names = queryInterface.addIndex.mock.calls.map(
      ([, , options]) => options.name,
    );

    expect(names).toContain("hu48_products_tax_id_idx");
    expect(names).toContain("hu48_orders_customer_id_idx");
    expect(names).toContain("hu48_invoices_order_id_idx");
    expect(names).toContain("hu48_lots_product_id_idx");
    expect(names).not.toContain("hu48_customers_state_id_idx");
    expect(names).not.toContain("hu48_stocks_product_warehouse_idx");
    expect(queryInterface.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "orders",
      ["customer_id"],
      { name: "hu48_orders_customer_id_idx", transaction: "transaction" },
    );
  });

  it("is idempotent when an equivalent index already exists", async () => {
    const queryInterface = setup(
      new Map([
        [
          "products",
          [
            {
              name: "products_category_id_idx",
              fields: [{ attribute: "category_id" }],
            },
          ],
        ],
      ]),
    );

    await migration.up(queryInterface);

    const names = queryInterface.addIndex.mock.calls.map(
      ([, , options]) => options.name,
    );

    expect(names).not.toContain("hu48_products_category_id_idx");
    expect(names).toContain("hu48_products_tax_id_idx");
  });

  it("removes only the indexes created by this migration", async () => {
    const queryInterface = setup(
      new Map([
        ["products", [{ name: "hu48_products_tax_id_idx" }]],
        ["customers", [{ name: "some_other_index" }]],
      ]),
    );

    await migration.down(queryInterface);

    expect(queryInterface.removeIndex).toHaveBeenCalledTimes(1);
    expect(queryInterface.removeIndex).toHaveBeenCalledWith(
      "products",
      "hu48_products_tax_id_idx",
      { transaction: "transaction" },
    );
    expect(queryInterface.sequelize.transaction).toHaveBeenCalledTimes(1);
  });
});
