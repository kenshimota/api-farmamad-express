"use strict";

const {
  toCents,
  toDecimal,
  toTotalsAmounts,
} = require("../src/purchases/money");

const PURCHASES = "purchases";
const PURCHASE_ITEMS = "purchase_items";
const TAX_RATE_CHECK = "purchases_tax_rate_range";
const TAX_AMOUNT_CHECK = "purchase_items_tax_amount_non_negative";
const EFFECTIVE_RATE_SQL = `UPDATE purchases
SET tax_rate = CASE
  WHEN subtotal > 0 THEN LEAST(100, GREATEST(0, ROUND(tax_amount / subtotal * 100, 2)))
  ELSE 0
END`;

/**
 * Splits an absolute tax amount in cents proportionally to the line subtotals
 * in cents. Every line gets the floor of its share and the last line receives
 * the remainder, so the result always adds up to the original amount. When the
 * subtotal is zero the last line receives the whole amount.
 * @param {number} taxCents - Tax amount in cents.
 * @param {number[]} subtotalCentsList - Line subtotals in cents.
 * @returns {number[]} The allocated tax in cents per line.
 */
function allocateTaxCents(taxCents, subtotalCentsList) {
  const count = subtotalCentsList.length;

  if (count === 0) {
    return [];
  }

  const totalCents = subtotalCentsList.reduce(
    (sum, subtotal) => sum + subtotal,
    0,
  );

  if (totalCents <= 0) {
    const allocation = new Array(count).fill(0);

    allocation[count - 1] = taxCents;

    return allocation;
  }

  let allocated = 0;

  return subtotalCentsList.map((subtotal, index) => {
    if (index === count - 1) {
      return taxCents - allocated;
    }

    const share = Math.floor((taxCents * subtotal) / totalCents);

    allocated += share;

    return share;
  });
}

/**
 * Reads raw rows through the query interface inside a transaction.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string} table - Table name.
 * @param {object} options - Select options.
 * @param {object} transaction - Open transaction.
 * @returns {Promise<object[]>} The rows.
 */
function selectRows(queryInterface, table, options, transaction) {
  return queryInterface.select(null, table, {
    ...options,
    raw: true,
    transaction,
  });
}

/**
 * Distributes every historical header tax between its lines and recalculates
 * the purchase header from the resulting lines.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {object} transaction - Open transaction.
 * @returns {Promise<void>}
 */
async function backfillTaxAmounts(queryInterface, transaction) {
  const purchases = await selectRows(
    queryInterface,
    PURCHASES,
    {
      attributes: ["id", "subtotal", "tax_amount"],
      order: [["id", "ASC"]],
    },
    transaction,
  );

  for (const purchase of purchases) {
    const items = await selectRows(
      queryInterface,
      PURCHASE_ITEMS,
      {
        attributes: ["id", "subtotal"],
        where: { purchase_id: purchase.id },
        order: [["id", "ASC"]],
      },
      transaction,
    );
    const subtotalCentsList = items.map((item) => toCents(item.subtotal));
    const allocation = allocateTaxCents(
      toCents(purchase.tax_amount),
      subtotalCentsList,
    );
    let subtotalCents = 0;
    let taxCents = 0;

    for (let index = 0; index < items.length; index += 1) {
      subtotalCents += subtotalCentsList[index];
      taxCents += allocation[index];

      await queryInterface.bulkUpdate(
        PURCHASE_ITEMS,
        { tax_amount: toDecimal(allocation[index] / 100) },
        { id: items[index].id },
        { transaction },
      );
    }

    await queryInterface.bulkUpdate(
      PURCHASES,
      toTotalsAmounts({
        subtotal: subtotalCents / 100,
        tax_amount: taxCents / 100,
        total: (subtotalCents + taxCents) / 100,
      }),
      { id: purchase.id },
      { transaction },
    );
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        PURCHASE_ITEMS,
        "tax_amount",
        { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        { transaction },
      );

      await backfillTaxAmounts(queryInterface, transaction);

      await queryInterface.changeColumn(
        PURCHASE_ITEMS,
        "tax_amount",
        {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
        },
        { transaction },
      );

      await queryInterface.addConstraint(PURCHASE_ITEMS, {
        fields: ["tax_amount"],
        type: "check",
        name: TAX_AMOUNT_CHECK,
        where: { tax_amount: { [Sequelize.Op.gte]: 0 } },
        transaction,
      });

      await queryInterface.removeConstraint(PURCHASES, TAX_RATE_CHECK, {
        transaction,
      });
      await queryInterface.removeColumn(PURCHASES, "tax_rate", { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        PURCHASES,
        "tax_rate",
        { type: Sequelize.DECIMAL(5, 2), allowNull: true },
        { transaction },
      );
      await queryInterface.sequelize.query(EFFECTIVE_RATE_SQL, { transaction });
      await queryInterface.changeColumn(
        PURCHASES,
        "tax_rate",
        {
          type: Sequelize.DECIMAL(5, 2),
          allowNull: false,
          defaultValue: 16,
        },
        { transaction },
      );
      await queryInterface.addConstraint(PURCHASES, {
        fields: ["tax_rate"],
        type: "check",
        name: TAX_RATE_CHECK,
        where: { tax_rate: { [Sequelize.Op.between]: [0, 100] } },
        transaction,
      });
      await queryInterface.removeConstraint(PURCHASE_ITEMS, TAX_AMOUNT_CHECK, {
        transaction,
      });
      await queryInterface.removeColumn(PURCHASE_ITEMS, "tax_amount", {
        transaction,
      });
    });
  },

  allocateTaxCents,
};
