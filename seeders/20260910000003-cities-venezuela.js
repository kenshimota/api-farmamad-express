"use strict";

const { Op } = require("sequelize");

const CITIES = Object.freeze([
  { name: "Puerto Ayacucho", state: "Amazonas" },
  { name: "Barcelona", state: "Anzoátegui" },
  { name: "San Fernando de Apure", state: "Apure" },
  { name: "Maracay", state: "Aragua" },
  { name: "Barinas", state: "Barinas" },
  { name: "Ciudad Bolívar", state: "Bolívar" },
  { name: "Valencia", state: "Carabobo" },
  { name: "San Carlos", state: "Cojedes" },
  { name: "Tucupita", state: "Delta Amacuro" },
  { name: "Caracas", state: "Distrito Capital" },
  { name: "Coro", state: "Falcón" },
  { name: "San Juan de los Morros", state: "Guárico" },
  { name: "La Guaira", state: "La Guaira" },
  { name: "Barquisimeto", state: "Lara" },
  { name: "Mérida", state: "Mérida" },
  { name: "Los Teques", state: "Miranda" },
  { name: "Maturín", state: "Monagas" },
  { name: "La Asunción", state: "Nueva Esparta" },
  { name: "Guanare", state: "Portuguesa" },
  { name: "Cumaná", state: "Sucre" },
  { name: "San Cristóbal", state: "Táchira" },
  { name: "Trujillo", state: "Trujillo" },
  { name: "San Felipe", state: "Yaracuy" },
  { name: "Maracaibo", state: "Zulia" },
  { name: "Puerto La Cruz", state: "Anzoátegui" },
  { name: "El Tigre", state: "Anzoátegui" },
  { name: "Ciudad Guayana", state: "Bolívar" },
  { name: "Puerto Cabello", state: "Carabobo" },
  { name: "Punto Fijo", state: "Falcón" },
  { name: "Cabimas", state: "Zulia" },
  { name: "Acarigua", state: "Portuguesa" },
  { name: "Araure", state: "Portuguesa" },
  { name: "Valera", state: "Trujillo" },
  { name: "Guarenas", state: "Miranda" },
  { name: "Guatire", state: "Miranda" },
  { name: "Petare", state: "Miranda" },
  { name: "Baruta", state: "Miranda" },
  { name: "El Vigía", state: "Mérida" },
]);

/**
 * Resolves the id of a seeded state by its exact name.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string} name - State name.
 * @returns {Promise<number|null>} The state id or null.
 */
function findStateId(queryInterface, name) {
  return queryInterface.rawSelect("states", { where: { name } }, ["id"]);
}

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = [];

    for (const city of CITIES) {
      const stateId = await findStateId(queryInterface, city.state);

      if (stateId === null || stateId === undefined) {
        throw new Error(
          `State "${city.state}" is not seeded; cannot create city "${city.name}".`,
        );
      }

      rows.push({
        name: city.name,
        state_id: stateId,
        createdAt: now,
        updatedAt: now,
      });
    }

    await queryInterface.bulkInsert("cities", rows, {
      ignoreDuplicates: true,
    });
  },

  async down(queryInterface) {
    const conditions = [];

    for (const city of CITIES) {
      const stateId = await findStateId(queryInterface, city.state);

      if (stateId !== null && stateId !== undefined) {
        conditions.push({ name: city.name, state_id: stateId });
      }
    }

    if (conditions.length) {
      await queryInterface.bulkDelete("cities", { [Op.or]: conditions }, {});
    }
  },

  CITIES,
};
