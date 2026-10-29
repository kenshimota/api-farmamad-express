"use strict";

const STATES = Object.freeze([
  { name: "Amazonas", code: "VE-Z" },
  { name: "Anzoátegui", code: "VE-B" },
  { name: "Apure", code: "VE-C" },
  { name: "Aragua", code: "VE-D" },
  { name: "Barinas", code: "VE-E" },
  { name: "Bolívar", code: "VE-F" },
  { name: "Carabobo", code: "VE-G" },
  { name: "Cojedes", code: "VE-H" },
  { name: "Delta Amacuro", code: "VE-Y" },
  { name: "Distrito Capital", code: "VE-A" },
  { name: "Falcón", code: "VE-I" },
  { name: "Guárico", code: "VE-J" },
  { name: "La Guaira", code: "VE-X" },
  { name: "Lara", code: "VE-K" },
  { name: "Mérida", code: "VE-L" },
  { name: "Miranda", code: "VE-M" },
  { name: "Monagas", code: "VE-N" },
  { name: "Nueva Esparta", code: "VE-O" },
  { name: "Portuguesa", code: "VE-P" },
  { name: "Sucre", code: "VE-R" },
  { name: "Táchira", code: "VE-S" },
  { name: "Trujillo", code: "VE-T" },
  { name: "Yaracuy", code: "VE-U" },
  { name: "Zulia", code: "VE-V" },
]);

const NAMES = Object.freeze(STATES.map((state) => state.name));

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert(
      "states",
      STATES.map(({ name, code }) => ({
        name,
        code,
        createdAt: now,
        updatedAt: now,
      })),
      { ignoreDuplicates: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("states", { name: NAMES }, {});
  },

  STATES,
};
