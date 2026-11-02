"use strict";

const { Op } = require("sequelize");

const TABLE = "taxes";
const PRODUCTS_TABLE = "products";
const BASE_TAXES = Object.freeze([
  {
    code: "IVA",
    name: "Impuesto al Valor Agregado",
    rate: "16.00",
    description: "IVA general de Venezuela",
  },
  {
    code: "SIN_IVA",
    name: "Sin IVA",
    rate: "0.00",
    description: "Producto exento o no gravado",
  },
]);

/**
 * Resolves a tax id by code ignoring case.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string} code - Tax code.
 * @returns {Promise<number|null>} The tax id or null.
 */
async function findTaxId(queryInterface, code) {
  const id = await queryInterface.rawSelect(
    TABLE,
    { where: { code: { [Op.iLike]: code } } },
    ["id"],
  );

  return id === undefined || id === null ? null : id;
}

/**
 * Tells whether at least one product references the tax.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {number} id - Tax id.
 * @returns {Promise<boolean>} True when a product uses the tax.
 */
async function isTaxInUse(queryInterface, id) {
  const productId = await queryInterface.rawSelect(
    PRODUCTS_TABLE,
    { where: { tax_id: id } },
    ["id"],
  );

  return productId !== undefined && productId !== null;
}

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    for (const tax of BASE_TAXES) {
      // Never overwrite an existing tax: an administrator may have adjusted
      // its name, rate or active flag.
      if ((await findTaxId(queryInterface, tax.code)) !== null) {
        continue;
      }

      await queryInterface.bulkInsert(TABLE, [
        {
          ...tax,
          is_active: true,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
  },

  async down(queryInterface) {
    const removable = [];
    const preserved = [];

    for (const tax of BASE_TAXES) {
      const id = await findTaxId(queryInterface, tax.code);

      if (id === null) {
        continue;
      }

      if (await isTaxInUse(queryInterface, id)) {
        preserved.push(tax.code);
      } else {
        removable.push(id);
      }
    }

    if (removable.length > 0) {
      await queryInterface.bulkDelete(TABLE, { id: removable });
    }

    if (preserved.length > 0) {
      console.warn(
        `Base taxes in use were preserved on rollback: ${preserved.join(", ")}`,
      );
    }
  },
};
