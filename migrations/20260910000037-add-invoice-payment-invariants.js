"use strict";

const TABLE = "invoices";
const PAID_AMOUNT_CHECK = "invoices_paid_amount_within_total";
const PAYMENT_STATUS_INDEX = "invoices_payment_status_idx";

/**
 * Completes the invoice invariant reserved by HU-40 for the payments module:
 * `paid_amount` can never exceed `total`, and `payment_status` is indexed for
 * the listing filter. The columns and their own checks already exist.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint(TABLE, {
      fields: ["paid_amount"],
      type: "check",
      name: PAID_AMOUNT_CHECK,
      where: Sequelize.literal("paid_amount <= total"),
    });

    await queryInterface.addIndex(TABLE, ["payment_status"], {
      name: PAYMENT_STATUS_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(TABLE, PAYMENT_STATUS_INDEX);
    await queryInterface.removeConstraint(TABLE, PAID_AMOUNT_CHECK);
  },
};
