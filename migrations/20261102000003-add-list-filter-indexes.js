"use strict";

/**
 * Indexes for the filters used by the high-volume list endpoints. The `up`
 * checks both the existing indexes and the table columns, so running it twice
 * (or against a database that already has an equivalent index) is a no-op.
 * `down` removes only the indexes created by this migration.
 * @type {import('sequelize-cli').Migration}
 */
const INDEXES = Object.freeze([
  {
    table: "products",
    fields: ["category_id"],
    name: "hu48_products_category_id_idx",
  },
  { table: "products", fields: ["tax_id"], name: "hu48_products_tax_id_idx" },
  {
    table: "customers",
    fields: ["state_id"],
    name: "hu48_customers_state_id_idx",
  },
  {
    table: "customers",
    fields: ["city_id"],
    name: "hu48_customers_city_id_idx",
  },
  {
    table: "suppliers",
    fields: ["state_id"],
    name: "hu48_suppliers_state_id_idx",
  },
  {
    table: "suppliers",
    fields: ["city_id"],
    name: "hu48_suppliers_city_id_idx",
  },
  {
    table: "orders",
    fields: ["customer_id"],
    name: "hu48_orders_customer_id_idx",
  },
  { table: "orders", fields: ["status"], name: "hu48_orders_status_idx" },
  {
    table: "invoices",
    fields: ["customer_id"],
    name: "hu48_invoices_customer_id_idx",
  },
  {
    table: "invoices",
    fields: ["order_id"],
    name: "hu48_invoices_order_id_idx",
  },
  {
    table: "payments",
    fields: ["customer_id"],
    name: "hu48_payments_customer_id_idx",
  },
  {
    table: "payment_allocations",
    fields: ["invoice_id"],
    name: "hu48_payments_invoice_id_idx",
  },
  { table: "lots", fields: ["product_id"], name: "hu48_lots_product_id_idx" },
  {
    table: "stocks",
    fields: ["product_id", "warehouse_id"],
    name: "hu48_stocks_product_warehouse_idx",
  },
]);

/**
 * Reads the columns of a table through the query interface.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string} table - Table name.
 * @param {object} transaction - Open transaction.
 * @returns {Promise<Set<string>>} Column names.
 */
async function tableColumns(queryInterface, table, transaction) {
  const description = await queryInterface.describeTable(table, {
    transaction,
  });

  return new Set(Object.keys(description));
}

/**
 * Reads the indexes of a table.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string} table - Table name.
 * @param {object} transaction - Open transaction.
 * @returns {Promise<object[]>} Index descriptions.
 */
function tableIndexes(queryInterface, table, transaction) {
  return queryInterface.showIndex(table, { transaction });
}

/**
 * Tells whether an index already covers exactly the requested columns.
 * @param {object[]} indexes - Existing index descriptions.
 * @param {string[]} fields - Requested columns.
 * @returns {boolean} True when an equivalent index exists.
 */
function hasEquivalentIndex(indexes, fields) {
  return indexes.some((index) => {
    const columns = (index.fields ?? []).map(
      (field) => field.attribute ?? field.name,
    );

    return (
      columns.length === fields.length &&
      fields.every((field) => columns.includes(field))
    );
  });
}

module.exports = {
  INDEXES,
  async up(queryInterface) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      for (const { table, fields, name } of INDEXES) {
        const columns = await tableColumns(queryInterface, table, transaction);

        if (!fields.every((field) => columns.has(field))) {
          continue;
        }

        const indexes = await tableIndexes(queryInterface, table, transaction);

        if (hasEquivalentIndex(indexes, fields)) {
          continue;
        }

        await queryInterface.addIndex(table, fields, { name, transaction });
      }
    });
  },

  async down(queryInterface) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      for (const { table, name } of INDEXES) {
        const indexes = await tableIndexes(queryInterface, table, transaction);

        if (indexes.some((index) => index.name === name)) {
          await queryInterface.removeIndex(table, name, { transaction });
        }
      }
    });
  },
};
