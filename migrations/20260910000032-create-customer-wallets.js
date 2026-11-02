"use strict";

const TABLE = "customer_wallets";
const CUSTOMER_INDEX = "customer_wallets_customer_id_idx";
const CURRENCY_INDEX = "customer_wallets_currency_id_idx";
const UNIQUE_INDEX = "customer_wallets_customer_currency_unique";
const BALANCE_CHECK = "customer_wallets_balance_non_negative";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE, {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      currency_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      balance: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addConstraint(TABLE, {
      fields: ["customer_id"],
      type: "foreign key",
      name: `${TABLE}_customer_id_fkey`,
      references: { table: "customers", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["currency_id"],
      type: "foreign key",
      name: `${TABLE}_currency_id_fkey`,
      references: { table: "currencies", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["balance"],
      type: "check",
      name: BALANCE_CHECK,
      where: { balance: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.addIndex(TABLE, ["customer_id"], {
      name: CUSTOMER_INDEX,
    });
    await queryInterface.addIndex(TABLE, ["currency_id"], {
      name: CURRENCY_INDEX,
    });
    await queryInterface.addIndex(TABLE, ["customer_id", "currency_id"], {
      unique: true,
      name: UNIQUE_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
