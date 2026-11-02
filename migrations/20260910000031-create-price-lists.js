"use strict";

const PRICE_LISTS = "price_lists";
const CUSTOMERS = "customers";
const PERCENTAGE_CHECK = "price_lists_percentage_range";
const NAME_INDEX = "price_lists_name_lower_unique";
const CUSTOMER_FK = "customers_price_list_id_fkey";
const CUSTOMER_INDEX = "customers_price_list_id_idx";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(PRICE_LISTS, {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true,
        defaultValue: null,
      },
      percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addConstraint(PRICE_LISTS, {
      fields: ["percentage"],
      type: "check",
      name: PERCENTAGE_CHECK,
      where: {
        percentage: {
          [Sequelize.Op.gte]: 0,
          [Sequelize.Op.lt]: 100,
        },
      },
    });

    // The API compares names ignoring case, so the database also rejects
    // duplicates that only differ in case.
    await queryInterface.addIndex(
      PRICE_LISTS,
      [Sequelize.literal('LOWER("name")')],
      { unique: true, name: NAME_INDEX },
    );

    await queryInterface.addColumn(CUSTOMERS, "price_list_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addConstraint(CUSTOMERS, {
      fields: ["price_list_id"],
      type: "foreign key",
      name: CUSTOMER_FK,
      references: { table: PRICE_LISTS, field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addIndex(CUSTOMERS, ["price_list_id"], {
      name: CUSTOMER_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(CUSTOMERS, CUSTOMER_FK);
    await queryInterface.removeIndex(CUSTOMERS, CUSTOMER_INDEX);
    await queryInterface.removeColumn(CUSTOMERS, "price_list_id");
    await queryInterface.dropTable(PRICE_LISTS);
  },
};
