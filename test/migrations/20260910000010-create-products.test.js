const migration = require("../../migrations/20260910000010-create-products");

describe("migration 20260910000010-create-products", () => {
  it("creates the products table with its columns and constraints", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = {
      INTEGER: "INTEGER",
      TEXT: "TEXT",
      STRING: jest.fn((length) => `STRING(${length})`),
      DATE: "DATE",
    };

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.createTable).toHaveBeenCalledWith("products", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: { type: "STRING(150)", allowNull: false },
      description: { type: "TEXT", allowNull: false },
      reference: { type: "STRING(100)", allowNull: false, unique: true },
      category_id: { type: "INTEGER", allowNull: false },
      image_id: { type: "INTEGER", allowNull: false },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds explicit foreign keys that restrict deletion", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = {
      INTEGER: "INTEGER",
      TEXT: "TEXT",
      STRING: jest.fn((length) => `STRING(${length})`),
      DATE: "DATE",
    };

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("products", {
      fields: ["category_id"],
      type: "foreign key",
      name: "products_category_id_fkey",
      references: { table: "categories", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("products", {
      fields: ["image_id"],
      type: "foreign key",
      name: "products_image_id_fkey",
      references: { table: "images", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  });

  it("adds explicit indexes for both foreign keys", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = {
      INTEGER: "INTEGER",
      TEXT: "TEXT",
      STRING: jest.fn((length) => `STRING(${length})`),
      DATE: "DATE",
    };

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "products",
      ["category_id"],
      { name: "products_category_id_idx" },
    );
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "products",
      ["image_id"],
      { name: "products_image_id_idx" },
    );
  });

  it("drops the products table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.dropTable).toHaveBeenCalledWith("products");
  });
});
