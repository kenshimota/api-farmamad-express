"use strict";

const ORDERS = "orders";
const ORDER_ITEMS = "order_items";
const INVOICE_ITEMS = "invoice_items";
const TAX_COLUMNS = Object.freeze([
  ["tax_id", "INTEGER"],
  ["tax_code", "STRING(20)"],
  ["tax_name", "STRING(100)"],
  ["tax_rate", "DECIMAL(5,2)"],
  ["tax_amount", "DECIMAL(12,2)"],
  ["total", "DECIMAL(12,2)"],
]);

/**
 * Adds the tax snapshot to orders and their lines.
 *
 * `tax_rate`, `tax_amount` and `total` are required with safe defaults so the
 * existing rows keep working: the migration backfills `total = subtotal` and
 * leaves the tax at 0. `tax_id`, `tax_code` and `tax_name` are nullable
 * snapshots; deleting a tax from the catalog must not break a historical line.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(ORDERS, "tax_amount", {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addConstraint(ORDERS, {
      fields: ["tax_amount"],
      type: "check",
      name: "orders_tax_amount_non_negative",
      where: { tax_amount: { [Sequelize.Op.gte]: 0 } },
    });

    for (const table of [ORDER_ITEMS, INVOICE_ITEMS]) {
      await addTaxColumns(queryInterface, Sequelize, table);
      await addTaxConstraints(queryInterface, Sequelize, table);
      await queryInterface.sequelize.query(
        `UPDATE "${table}" SET "total" = "subtotal" WHERE "total" = 0`,
      );
    }
  },

  async down(queryInterface) {
    for (const table of [ORDER_ITEMS, INVOICE_ITEMS]) {
      await removeTaxConstraints(queryInterface, table);
      for (const [column] of [...TAX_COLUMNS].reverse()) {
        await queryInterface.removeColumn(table, column);
      }
    }

    await queryInterface.removeConstraint(
      ORDERS,
      "orders_tax_amount_non_negative",
    );
    await queryInterface.removeColumn(ORDERS, "tax_amount");
  },
};

/**
 * Adds the nullable and defaulted tax snapshot columns.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {object} Sequelize - Sequelize constructor.
 * @param {string} table - Target table.
 * @returns {Promise<void>}
 */
async function addTaxColumns(queryInterface, Sequelize, table) {
  await queryInterface.addColumn(table, "tax_id", {
    type: Sequelize.INTEGER,
    allowNull: true,
  });
  await queryInterface.addColumn(table, "tax_code", {
    type: Sequelize.STRING(20),
    allowNull: true,
  });
  await queryInterface.addColumn(table, "tax_name", {
    type: Sequelize.STRING(100),
    allowNull: true,
  });
  await queryInterface.addColumn(table, "tax_rate", {
    type: Sequelize.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
  });
  await queryInterface.addColumn(table, "tax_amount", {
    type: Sequelize.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  });
  await queryInterface.addColumn(table, "total", {
    type: Sequelize.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  });
}

/**
 * Adds the tax checks and the catalog foreign key.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {object} Sequelize - Sequelize constructor.
 * @param {string} table - Target table.
 * @returns {Promise<void>}
 */
async function addTaxConstraints(queryInterface, Sequelize, table) {
  await queryInterface.addConstraint(table, {
    fields: ["tax_id"],
    type: "foreign key",
    name: `${table}_tax_id_fkey`,
    references: { table: "taxes", field: "id" },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  });
  await queryInterface.addConstraint(table, {
    fields: ["tax_rate"],
    type: "check",
    name: `${table}_tax_rate_range`,
    where: { tax_rate: { [Sequelize.Op.between]: [0, 100] } },
  });
  await queryInterface.addConstraint(table, {
    fields: ["tax_amount"],
    type: "check",
    name: `${table}_tax_amount_non_negative`,
    where: { tax_amount: { [Sequelize.Op.gte]: 0 } },
  });
  await queryInterface.addConstraint(table, {
    fields: ["total"],
    type: "check",
    name: `${table}_total_non_negative`,
    where: { total: { [Sequelize.Op.gte]: 0 } },
  });
}

/**
 * Removes the tax checks and the catalog foreign key.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string} table - Target table.
 * @returns {Promise<void>}
 */
async function removeTaxConstraints(queryInterface, table) {
  const constraints = [
    `${table}_total_non_negative`,
    `${table}_tax_amount_non_negative`,
    `${table}_tax_rate_range`,
    `${table}_tax_id_fkey`,
  ];

  for (const constraint of constraints) {
    await queryInterface.removeConstraint(table, constraint);
  }
}
