"use strict";

const TABLE = "method_payment_types";
const CURRENCIES_TABLE = "currencies";
const REQUIRED_CURRENCY_CODES = Object.freeze(["USD_BCV", "USDT", "VES"]);
const TYPES = Object.freeze([
  {
    code: "PAYPAL",
    name: "PayPal",
    currencyCode: "USD_BCV",
    description: "Pagos por PayPal",
    fields: [
      {
        key: "email",
        label: "Correo de PayPal",
        type: "email",
        required: true,
      },
    ],
  },
  {
    code: "BINANCE",
    name: "Binance",
    currencyCode: "USDT",
    description: "Pagos con criptomonedas",
    fields: [
      {
        key: "wallet_address",
        label: "Dirección de wallet",
        type: "text",
        required: true,
        max_length: 200,
      },
      {
        key: "network",
        label: "Red",
        type: "text",
        required: true,
        max_length: 30,
      },
    ],
  },
  {
    code: "BANK",
    name: "Banco Nacional",
    currencyCode: "VES",
    description: "Cuentas bancarias nacionales",
    fields: [
      {
        key: "bank_name",
        label: "Banco",
        type: "text",
        required: true,
        max_length: 100,
      },
      {
        key: "account_number",
        label: "Número de cuenta",
        type: "text",
        required: true,
        max_length: 30,
      },
      {
        key: "account_type",
        label: "Tipo de cuenta",
        type: "text",
        required: true,
        max_length: 30,
      },
      {
        key: "holder_name",
        label: "Titular",
        type: "text",
        required: true,
        max_length: 100,
      },
      {
        key: "holder_id",
        label: "Cédula o RIF del titular",
        type: "text",
        required: true,
        max_length: 20,
      },
    ],
  },
  {
    code: "PAGO_MOVIL",
    name: "Pago Móvil",
    currencyCode: "VES",
    description: "Pagos móviles en bolívares",
    fields: [
      {
        key: "bank_name",
        label: "Banco",
        type: "text",
        required: true,
        max_length: 100,
      },
      {
        key: "phone",
        label: "Teléfono",
        type: "phone",
        required: true,
      },
      {
        key: "holder_id",
        label: "Cédula o RIF",
        type: "text",
        required: true,
        max_length: 20,
      },
    ],
  },
]);

/**
 * Resolves the id of a row by its code.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string} table - Table name.
 * @param {string} code - Row code.
 * @returns {Promise<number|null>} The id or null when it does not exist.
 */
async function findId(queryInterface, table, code) {
  const id = await queryInterface.rawSelect(table, { where: { code } }, ["id"]);

  return id === undefined || id === null ? null : id;
}

/**
 * Resolves every required currency code and fails with an actionable message
 * when the HU-22 seeder has not run yet.
 * @param {object} queryInterface - Sequelize query interface.
 * @returns {Promise<Record<string, number>>} Currency id per code.
 */
async function resolveCurrencies(queryInterface) {
  const currencyIds = {};
  const missing = [];

  for (const code of REQUIRED_CURRENCY_CODES) {
    const id = await findId(queryInterface, CURRENCIES_TABLE, code);

    if (id === null) {
      missing.push(code);
    } else {
      currencyIds[code] = id;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required currencies for method payment types: ${missing.join(
        ", ",
      )}. Run the currencies seeder (HU-22) first.`,
    );
  }

  return currencyIds;
}

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const currencyIds = await resolveCurrencies(queryInterface);

    for (const type of TYPES) {
      // Never overwrite an existing type: an administrator may have already
      // changed its name, status or field definitions.
      if ((await findId(queryInterface, TABLE, type.code)) !== null) {
        continue;
      }

      await queryInterface.bulkInsert(TABLE, [
        {
          code: type.code,
          name: type.name,
          currency_id: currencyIds[type.currencyCode],
          // bulkInsert bypasses the model and does not serialize JSONB
          // values, so the array is sent as a JSON text literal.
          fields: JSON.stringify(type.fields),
          description: type.description,
          is_active: true,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(TABLE, {
      code: TYPES.map((type) => type.code),
    });
  },
};
