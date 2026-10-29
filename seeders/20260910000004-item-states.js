"use strict";

const { ForeignKeyConstraintError } = require("sequelize");

const TABLE = "item_states";
const ITEM_STATES = Object.freeze([
  {
    name: "sellable",
    label: "Vendible",
    description: null,
    is_sellable: true,
  },
  {
    name: "damaged",
    label: "Maltratado",
    description: null,
    is_sellable: false,
  },
  {
    name: "expired",
    label: "Vencido",
    description: null,
    is_sellable: false,
  },
  {
    name: "quarantine",
    label: "Cuarentena",
    description: null,
    is_sellable: false,
  },
  {
    name: "reserved",
    label: "Reservado",
    description: null,
    is_sellable: false,
  },
]);

const NAMES = Object.freeze(ITEM_STATES.map((itemState) => itemState.name));

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert(
      TABLE,
      ITEM_STATES.map((itemState) => ({
        ...itemState,
        createdAt: now,
        updatedAt: now,
      })),
      { ignoreDuplicates: true },
    );
  },

  async down(queryInterface) {
    for (const name of NAMES) {
      try {
        await queryInterface.bulkDelete(TABLE, { name }, {});
      } catch (error) {
        // A referenced item state cannot be removed; the remaining seed rows
        // are still cleaned up. Costs, stocks and purchases arrive with
        // HU-19/20/21 and will start enforcing those foreign keys.
        if (!(error instanceof ForeignKeyConstraintError)) {
          throw error;
        }
      }
    }
  },

  ITEM_STATES,
};
