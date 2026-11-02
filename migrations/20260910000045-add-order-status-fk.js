"use strict";

const STATUS_TABLE = "order_statuses";
const ORDER_TABLE = "orders";
const HISTORY_TABLE = "order_history";
const OLD_CHECK = "orders_status_check";
const ORDER_FOREIGN_KEY = "orders_status_code_fkey";
const HISTORY_FROM_FOREIGN_KEY = "order_history_from_status_code_fkey";
const HISTORY_TO_FOREIGN_KEY = "order_history_to_status_code_fkey";
const OLD_STATUSES = Object.freeze([
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
]);

const FORWARD_MAP = Object.freeze({
  pending: "request",
  confirmed: "generate",
  preparing: "generate",
  shipped: "generate",
  delivered: "invoiced",
  cancelled: "cancelled",
});
const BACKWARD_MAP = Object.freeze({
  draft: "pending",
  request: "pending",
  generate: "confirmed",
  invoiced: "delivered",
  cancelled: "cancelled",
});

/**
 * Builds the forward CASE expression used to map the legacy statuses.
 * @returns {string} SQL CASE expression.
 */
function forwardCase() {
  const branches = Object.entries(FORWARD_MAP)
    .map(([from, to]) => `WHEN '${from}' THEN '${to}'`)
    .join(" ");

  return `CASE status ${branches} ELSE status END`;
}

/**
 * Builds the reverse CASE expression used to restore the legacy statuses.
 * Unknown codes (additional statuses) fall back to `pending`.
 * @param {string} column - Column name.
 * @returns {string} SQL CASE expression.
 */
function backwardCase(column) {
  const branches = Object.entries(BACKWARD_MAP)
    .map(([from, to]) => `WHEN "${column}" = '${from}' THEN '${to}'`)
    .join(" ");

  return `CASE WHEN "${column}" IS NULL THEN NULL ${branches} ELSE 'pending' END`;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(ORDER_TABLE, OLD_CHECK);

    await queryInterface.sequelize.query(
      `UPDATE "${ORDER_TABLE}" SET "status" = ${forwardCase()}`,
    );
    await queryInterface.sequelize.query(
      `UPDATE "${HISTORY_TABLE}" SET "from_status" = CASE "from_status" ${Object.entries(
        FORWARD_MAP,
      )
        .map(([from, to]) => `WHEN '${from}' THEN '${to}'`)
        .join(" ")} ELSE "from_status" END`,
    );
    await queryInterface.sequelize.query(
      `UPDATE "${HISTORY_TABLE}" SET "to_status" = CASE "to_status" ${Object.entries(
        FORWARD_MAP,
      )
        .map(([from, to]) => `WHEN '${from}' THEN '${to}'`)
        .join(" ")} ELSE "to_status" END`,
    );

    await queryInterface.changeColumn(ORDER_TABLE, "status", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "draft",
    });

    await queryInterface.addConstraint(ORDER_TABLE, {
      fields: ["status"],
      type: "foreign key",
      name: ORDER_FOREIGN_KEY,
      references: { table: STATUS_TABLE, field: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(HISTORY_TABLE, {
      fields: ["from_status"],
      type: "foreign key",
      name: HISTORY_FROM_FOREIGN_KEY,
      references: { table: STATUS_TABLE, field: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(HISTORY_TABLE, {
      fields: ["to_status"],
      type: "foreign key",
      name: HISTORY_TO_FOREIGN_KEY,
      references: { table: STATUS_TABLE, field: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(
      HISTORY_TABLE,
      HISTORY_TO_FOREIGN_KEY,
    );
    await queryInterface.removeConstraint(
      HISTORY_TABLE,
      HISTORY_FROM_FOREIGN_KEY,
    );
    await queryInterface.removeConstraint(ORDER_TABLE, ORDER_FOREIGN_KEY);

    await queryInterface.sequelize.query(
      `UPDATE "${HISTORY_TABLE}" SET "from_status" = ${backwardCase("from_status")}`,
    );
    await queryInterface.sequelize.query(
      `UPDATE "${HISTORY_TABLE}" SET "to_status" = ${backwardCase("to_status")}`,
    );
    await queryInterface.sequelize.query(
      `UPDATE "${ORDER_TABLE}" SET "status" = ${backwardCase("status")}`,
    );

    await queryInterface.changeColumn(ORDER_TABLE, "status", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    });

    await queryInterface.addConstraint(ORDER_TABLE, {
      fields: ["status"],
      type: "check",
      name: OLD_CHECK,
      where: { status: { [Sequelize.Op.in]: [...OLD_STATUSES] } },
    });
  },
};
