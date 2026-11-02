"use strict";

const TABLE = "products";
const TAXES_TABLE = "taxes";
const TAX_FK = "products_tax_id_fkey";
const TAX_INDEX = "products_tax_id_idx";
const DEFAULT_TAX = Object.freeze({
  code: "SIN_IVA",
  name: "Sin IVA",
  rate: "0.00",
  description: "Producto exento o no gravado",
});

/**
 * Runs the migration work inside a transaction when the query interface
 * exposes one. Sequelize CLI does not wrap migrations itself, so the
 * migration owns the atomicity of its DDL and backfill.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {(options: object) => Promise<*>} work - Work to run.
 * @returns {Promise<*>} The work result.
 */
function runInTransaction(queryInterface, work) {
  const sequelize = queryInterface.sequelize;

  if (!sequelize || typeof sequelize.transaction !== "function") {
    return work({});
  }

  return sequelize.transaction((transaction) => work({ transaction }));
}

/**
 * Resolves a tax id by code ignoring case.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {object} Sequelize - Sequelize module with its operators.
 * @param {string} code - Tax code.
 * @param {object} options - Query options, including the transaction.
 * @returns {Promise<number|null>} The tax id or null.
 */
async function findTaxId(queryInterface, Sequelize, code, options) {
  const id = await queryInterface.rawSelect(
    TAXES_TABLE,
    {
      where: { code: { [Sequelize.Op.iLike]: code } },
      ...options,
    },
    ["id"],
  );

  return id === undefined || id === null ? null : id;
}

/**
 * Resolves the SIN_IVA tax, creating it when the catalog does not have it yet.
 * An existing row is reused without changing its name, rate or active flag.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {object} Sequelize - Sequelize module.
 * @param {object} options - Query options, including the transaction.
 * @returns {Promise<number>} The SIN_IVA tax id.
 * @throws {Error} When the inserted tax cannot be resolved afterwards.
 */
async function ensureDefaultTax(queryInterface, Sequelize, options) {
  const existing = await findTaxId(
    queryInterface,
    Sequelize,
    DEFAULT_TAX.code,
    options,
  );

  if (existing !== null) {
    return existing;
  }

  const now = new Date();

  await queryInterface.bulkInsert(
    TAXES_TABLE,
    [
      {
        ...DEFAULT_TAX,
        is_active: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    options,
  );

  const created = await findTaxId(
    queryInterface,
    Sequelize,
    DEFAULT_TAX.code,
    options,
  );

  if (created === null) {
    throw new Error("Could not resolve the SIN_IVA tax after inserting it");
  }

  return created;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await runInTransaction(queryInterface, async (options) => {
      await queryInterface.addColumn(
        TABLE,
        "tax_id",
        { type: Sequelize.INTEGER, allowNull: true },
        options,
      );

      const taxId = await ensureDefaultTax(queryInterface, Sequelize, options);

      await queryInterface.bulkUpdate(
        TABLE,
        { tax_id: taxId },
        { tax_id: null },
        options,
      );

      await queryInterface.changeColumn(
        TABLE,
        "tax_id",
        { type: Sequelize.INTEGER, allowNull: false },
        options,
      );

      await queryInterface.addConstraint(TABLE, {
        fields: ["tax_id"],
        type: "foreign key",
        name: TAX_FK,
        references: { table: TAXES_TABLE, field: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
        ...options,
      });

      await queryInterface.addIndex(TABLE, ["tax_id"], {
        name: TAX_INDEX,
        ...options,
      });
    });
  },

  async down(queryInterface) {
    await runInTransaction(queryInterface, async (options) => {
      await queryInterface.removeIndex(TABLE, TAX_INDEX, options);
      await queryInterface.removeConstraint(TABLE, TAX_FK, options);
      await queryInterface.removeColumn(TABLE, "tax_id", options);
    });
  },
};
