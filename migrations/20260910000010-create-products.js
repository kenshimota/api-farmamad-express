"use strict";

const TABLE = "products";

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
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      reference: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      image_id: {
        type: Sequelize.INTEGER,
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

    await queryInterface.addConstraint(TABLE, {
      fields: ["category_id"],
      type: "foreign key",
      name: "products_category_id_fkey",
      references: { table: "categories", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["image_id"],
      type: "foreign key",
      name: "products_image_id_fkey",
      references: { table: "images", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addIndex(TABLE, ["category_id"], {
      name: "products_category_id_idx",
    });

    await queryInterface.addIndex(TABLE, ["image_id"], {
      name: "products_image_id_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
