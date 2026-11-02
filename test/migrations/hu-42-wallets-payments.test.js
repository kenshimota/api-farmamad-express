const usersMigration = require("../../migrations/20260910000031-add-customer-id-to-users");
const walletsMigration = require("../../migrations/20260910000032-create-customer-wallets");
const paymentsMigration = require("../../migrations/20260910000033-create-payments");
const transactionsMigration = require("../../migrations/20260910000034-create-wallet-transactions");

/**
 * Builds the Sequelize type double used by the migrations.
 * @returns {object} Sequelize double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    TEXT: "TEXT",
    DATE: "DATE",
    STRING: jest.fn((length) => `STRING(${length})`),
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    literal: jest.fn((sql) => `LITERAL:${sql}`),
    Op: { gt: "GT", gte: "GTE", ne: "NE", in: "IN" },
  };
}

/**
 * Builds a query interface double.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble() {
  return {
    addColumn: jest.fn(),
    addConstraint: jest.fn(),
    addIndex: jest.fn(),
    createTable: jest.fn(),
    dropTable: jest.fn(),
    removeColumn: jest.fn(),
    removeConstraint: jest.fn(),
    removeIndex: jest.fn(),
  };
}

describe("migration HU-42", () => {
  it("links users to customers reversibly", async () => {
    const query = queryInterfaceDouble();

    await usersMigration.up(query, sequelizeDouble());

    expect(query.addColumn).toHaveBeenCalledWith("users", "customer_id", {
      type: "INTEGER",
      allowNull: true,
    });
    expect(query.addConstraint).toHaveBeenCalledWith("users", {
      fields: ["customer_id"],
      type: "foreign key",
      name: "users_customer_id_fkey",
      references: { table: "customers", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(query.addIndex).toHaveBeenCalledWith("users", ["customer_id"], {
      name: "users_customer_id_idx",
    });

    await usersMigration.down(query);
    expect(query.removeIndex).toHaveBeenCalledWith(
      "users",
      "users_customer_id_idx",
    );
    expect(query.removeConstraint).toHaveBeenCalledWith(
      "users",
      "users_customer_id_fkey",
    );
    expect(query.removeColumn).toHaveBeenCalledWith("users", "customer_id");
  });

  it("creates customer_wallets with money constraints and a unique pair", async () => {
    const query = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await walletsMigration.up(query, Sequelize);

    expect(query.createTable).toHaveBeenCalledWith(
      "customer_wallets",
      expect.objectContaining({
        customer_id: { type: "INTEGER", allowNull: false },
        currency_id: { type: "INTEGER", allowNull: false },
        balance: {
          type: "DECIMAL(14,2)",
          allowNull: false,
          defaultValue: 0,
        },
      }),
    );
    expect(query.addConstraint).toHaveBeenCalledWith("customer_wallets", {
      fields: ["balance"],
      type: "check",
      name: "customer_wallets_balance_non_negative",
      where: { balance: { GTE: 0 } },
    });
    expect(query.addIndex).toHaveBeenCalledWith(
      "customer_wallets",
      ["customer_id", "currency_id"],
      {
        unique: true,
        name: "customer_wallets_customer_currency_unique",
      },
    );

    await walletsMigration.down(query);
    expect(query.dropTable).toHaveBeenCalledWith("customer_wallets");
  });

  it("creates payments with its four foreign keys and indexes", async () => {
    const query = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await paymentsMigration.up(query, Sequelize);

    expect(query.createTable).toHaveBeenCalledWith(
      "payments",
      expect.objectContaining({
        amount: { type: "DECIMAL(14,2)", allowNull: false },
        paid_at: expect.objectContaining({ allowNull: false }),
      }),
    );
    expect(query.addConstraint).toHaveBeenCalledTimes(5);
    expect(query.addConstraint).toHaveBeenCalledWith("payments", {
      fields: ["amount"],
      type: "check",
      name: "payments_amount_positive",
      where: { amount: { GT: 0 } },
    });
    expect(query.addIndex).toHaveBeenCalledWith("payments", ["paid_at"], {
      name: "payments_paid_at_idx",
    });

    await paymentsMigration.down(query);
    expect(query.dropTable).toHaveBeenCalledWith("payments");
  });

  it("creates wallet_transactions without invoice foreign keys", async () => {
    const query = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await transactionsMigration.up(query, Sequelize);

    expect(query.createTable).toHaveBeenCalledWith(
      "wallet_transactions",
      expect.objectContaining({
        transaction_type: { type: "STRING(20)", allowNull: false },
        amount: { type: "DECIMAL(14,2)", allowNull: false },
        balance_after: { type: "DECIMAL(14,2)", allowNull: false },
        invoice_id: { type: "INTEGER", allowNull: true },
        payment_allocation_id: { type: "INTEGER", allowNull: true },
      }),
    );
    expect(query.addConstraint).not.toHaveBeenCalledWith(
      "wallet_transactions",
      expect.objectContaining({ fields: ["invoice_id"] }),
    );
    expect(query.addConstraint).toHaveBeenCalledWith("wallet_transactions", {
      fields: ["transaction_type"],
      type: "check",
      name: "wallet_transactions_type_check",
      where: { transaction_type: { IN: ["deposit", "invoice_payment"] } },
    });
    expect(query.addIndex).toHaveBeenCalledWith(
      "wallet_transactions",
      ["wallet_id", "createdAt", "id"],
      { name: "wallet_transactions_wallet_created_idx" },
    );

    await transactionsMigration.down(query);
    expect(query.dropTable).toHaveBeenCalledWith("wallet_transactions");
  });
});
