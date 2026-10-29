"use strict";

const ROLES = [
  "admin",
  "customer",
  "seller",
  "dispatcher",
  "manager_warehouse",
  "support",
];
const PREVIOUS_ROLES = [
  "admin",
  "seller",
  "delivery",
  "freelance_delivery",
  "customer",
];
const LEGACY_ROLES = ["delivery", "freelance_delivery"];
const NEW_ONLY_ROLES = ["dispatcher", "manager_warehouse", "support"];
const MIGRATED_ROLE = "dispatcher";
const ROLLBACK_ROLE = "delivery";

/**
 * Resolves a role id by name. Ids are never hard-coded because the catalog can
 * have been seeded in a different order.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string} name - Role name.
 * @returns {Promise<number|null>} Role id or null when it does not exist.
 */
async function findRoleId(queryInterface, name) {
  const id = await queryInterface.rawSelect("roles", { where: { name } }, [
    "id",
  ]);

  return id || null;
}

/**
 * Inserts only the roles that are missing from the catalog.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string[]} names - Expected role names.
 * @returns {Promise<void>}
 */
async function insertMissingRoles(queryInterface, names) {
  const missing = [];

  for (const name of names) {
    if (!(await findRoleId(queryInterface, name))) {
      missing.push(name);
    }
  }

  if (!missing.length) {
    return;
  }

  const now = new Date();

  await queryInterface.bulkInsert(
    "roles",
    missing.map((name) => ({ name, createdAt: now, updatedAt: now })),
    { ignoreDuplicates: true },
  );
}

/**
 * Collects the ids of the roles that exist in the catalog.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string[]} names - Role names to resolve.
 * @returns {Promise<number[]>} Existing role ids.
 */
async function collectRoleIds(queryInterface, names) {
  const ids = [];

  for (const name of names) {
    const id = await findRoleId(queryInterface, name);

    if (id) {
      ids.push(id);
    }
  }

  return ids;
}

/**
 * Moves the users of the obsolete roles to the replacement role and then
 * deletes the obsolete roles, keeping every user with a valid reference.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {object} options - Replacement details.
 * @param {string} options.replacement - Role name that receives the users.
 * @param {string[]} options.obsolete - Role names to retire.
 * @param {string} options.missingMessage - Message when the replacement is missing.
 * @returns {Promise<void>}
 */
async function retireRoles(
  queryInterface,
  { replacement, obsolete, missingMessage },
) {
  const replacementRoleId = await findRoleId(queryInterface, replacement);

  if (!replacementRoleId) {
    throw new Error(missingMessage);
  }

  const obsoleteRoleIds = await collectRoleIds(queryInterface, obsolete);

  if (!obsoleteRoleIds.length) {
    return;
  }

  await queryInterface.bulkUpdate(
    "users",
    { roleId: replacementRoleId },
    { roleId: obsoleteRoleIds },
  );
  await queryInterface.bulkDelete("roles", { name: obsolete }, {});
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await insertMissingRoles(queryInterface, ROLES);
    await retireRoles(queryInterface, {
      replacement: MIGRATED_ROLE,
      obsolete: LEGACY_ROLES,
      missingMessage: `Role "${MIGRATED_ROLE}" is required for the migration`,
    });
  },

  async down(queryInterface) {
    await insertMissingRoles(queryInterface, PREVIOUS_ROLES);
    await retireRoles(queryInterface, {
      replacement: ROLLBACK_ROLE,
      obsolete: NEW_ONLY_ROLES,
      missingMessage: `Role "${ROLLBACK_ROLE}" is required for the rollback`,
    });
  },
};
