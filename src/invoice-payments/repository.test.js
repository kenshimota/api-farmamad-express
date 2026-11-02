jest.mock("../database", () => ({ transaction: jest.fn() }));
jest.mock("../models/payment-allocation", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../models/invoice", () => ({ findByPk: jest.fn() }));
jest.mock("../models/payment", () => ({ findByPk: jest.fn() }));
jest.mock("../models/customer-wallet", () => ({ findOne: jest.fn() }));
jest.mock("../models/wallet-transaction", () => ({ create: jest.fn() }));
jest.mock("../models/currency", () => ({ findByPk: jest.fn() }));
jest.mock("../models/method-payment", () => ({}));
jest.mock("../models/method-payment-type", () => ({}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const db = require("../database");
const PaymentAllocation = require("../models/payment-allocation");
const Invoice = require("../models/invoice");
const Payment = require("../models/payment");
const CustomerWallet = require("../models/customer-wallet");
const WalletTransaction = require("../models/wallet-transaction");
const Currency = require("../models/currency");
const User = require("../models/user");
const { LIST_ORDER, createInvoicePaymentRepository } = require("./repository");

const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const repository = createInvoicePaymentRepository();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("invoice payment repository", () => {
  it("runs the callback inside a transaction", async () => {
    db.transaction.mockImplementation((callback) => callback(TRANSACTION));

    await expect(
      repository.transaction(async (transaction) => transaction),
    ).resolves.toBe(TRANSACTION);
  });

  it("locks the invoice and attaches its currency", async () => {
    const invoice = { id: 1, currency_id: 3, setDataValue: jest.fn() };
    const currency = { id: 3, rate: "1.000000" };
    Invoice.findByPk.mockResolvedValue(invoice);
    Currency.findByPk.mockResolvedValue(currency);

    await expect(repository.findInvoiceForUpdate(1, TRANSACTION)).resolves.toBe(
      invoice,
    );
    expect(Invoice.findByPk).toHaveBeenCalledWith(1, {
      transaction: TRANSACTION,
      lock: TRANSACTION.LOCK.UPDATE,
    });
    expect(Currency.findByPk).toHaveBeenCalledWith(3, {
      transaction: TRANSACTION,
    });
    expect(invoice.setDataValue).toHaveBeenCalledWith("currency", currency);
  });

  it("returns null without loading the currency when the invoice is missing", async () => {
    Invoice.findByPk.mockResolvedValue(null);

    await expect(
      repository.findInvoiceForUpdate(1, TRANSACTION),
    ).resolves.toBeNull();
    expect(Currency.findByPk).not.toHaveBeenCalled();
  });

  it("locks the payment and attaches its currency", async () => {
    const payment = { id: 5, currency_id: 2, setDataValue: jest.fn() };
    const currency = { id: 2, rate: "2.000000" };
    Payment.findByPk.mockResolvedValue(payment);
    Currency.findByPk.mockResolvedValue(currency);

    await expect(repository.findPaymentForUpdate(5, TRANSACTION)).resolves.toBe(
      payment,
    );
    expect(Payment.findByPk).toHaveBeenCalledWith(5, {
      transaction: TRANSACTION,
      lock: TRANSACTION.LOCK.UPDATE,
    });
    expect(payment.setDataValue).toHaveBeenCalledWith("currency", currency);
  });

  it("returns null when the payment is missing", async () => {
    Payment.findByPk.mockResolvedValue(null);

    await expect(
      repository.findPaymentForUpdate(5, TRANSACTION),
    ).resolves.toBeNull();
    expect(Currency.findByPk).not.toHaveBeenCalled();
  });

  it("finds an existing allocation by payment and invoice", async () => {
    const allocation = { id: 11 };
    PaymentAllocation.findOne.mockResolvedValue(allocation);

    await expect(repository.findAllocation(5, 1, TRANSACTION)).resolves.toBe(
      allocation,
    );
    expect(PaymentAllocation.findOne).toHaveBeenCalledWith({
      where: { payment_id: 5, invoice_id: 1 },
      transaction: TRANSACTION,
    });
  });

  it("locks the wallet of the customer and currency", async () => {
    const wallet = { id: 7 };
    CustomerWallet.findOne.mockResolvedValue(wallet);

    await expect(
      repository.findWalletForUpdate(8, 2, TRANSACTION),
    ).resolves.toBe(wallet);
    expect(CustomerWallet.findOne).toHaveBeenCalledWith({
      where: { customer_id: 8, currency_id: 2 },
      transaction: TRANSACTION,
      lock: TRANSACTION.LOCK.UPDATE,
    });
  });

  it("creates the immutable allocation", async () => {
    const values = { payment_id: 5, invoice_id: 1 };
    const options = { transaction: TRANSACTION };
    PaymentAllocation.create.mockResolvedValue({ id: 11, ...values });

    await expect(
      repository.createAllocation(values, options),
    ).resolves.toMatchObject({ id: 11 });
    expect(PaymentAllocation.create).toHaveBeenCalledWith(values, options);
  });

  it("decrements the wallet and reloads it", async () => {
    const wallet = {
      id: 7,
      increment: jest.fn().mockResolvedValue(),
      reload: jest.fn().mockResolvedValue({ id: 7, balance: "90.00" }),
    };

    await expect(
      repository.debitWallet(wallet, 10, { transaction: TRANSACTION }),
    ).resolves.toEqual({ id: 7, balance: "90.00" });
    expect(wallet.increment).toHaveBeenCalledWith("balance", {
      by: -10,
      transaction: TRANSACTION,
    });
    expect(wallet.reload).toHaveBeenCalledWith({ transaction: TRANSACTION });
  });

  it("appends the wallet movement and updates the invoice", async () => {
    const movement = { id: 21 };
    const values = { transaction_type: "invoice_payment" };
    const options = { transaction: TRANSACTION };
    const invoice = {
      update: jest.fn().mockResolvedValue({ id: 1, paid_amount: "10.00" }),
    };
    WalletTransaction.create.mockResolvedValue(movement);

    await expect(
      repository.createWalletTransaction(values, options),
    ).resolves.toBe(movement);
    await expect(
      repository.updateInvoice(invoice, { paid_amount: 10 }, options),
    ).resolves.toMatchObject({ paid_amount: "10.00" });
    expect(WalletTransaction.create).toHaveBeenCalledWith(values, options);
    expect(invoice.update).toHaveBeenCalledWith({ paid_amount: 10 }, options);
  });

  it("reloads an allocation with its payment and currency", async () => {
    const allocation = { id: 11 };
    PaymentAllocation.findByPk.mockResolvedValue(allocation);

    await expect(repository.reloadAllocation(11, TRANSACTION)).resolves.toBe(
      allocation,
    );
    const options = PaymentAllocation.findByPk.mock.calls[0][1];
    expect(options.transaction).toBe(TRANSACTION);
    expect(options.include[0]).toMatchObject({
      model: Payment,
      as: "payment",
    });
    expect(options.include[0].include).toEqual(
      expect.arrayContaining([expect.objectContaining({ model: Currency })]),
    );
  });

  it("loads an invoice and the authenticated user", async () => {
    const invoice = { id: 1 };
    const user = { id: 5, customer_id: 8 };
    Invoice.findByPk.mockResolvedValue(invoice);
    User.findByPk.mockResolvedValue(user);

    await expect(repository.findInvoiceById(1)).resolves.toBe(invoice);
    await expect(repository.findUserById(5, TRANSACTION)).resolves.toBe(user);
    expect(User.findByPk).toHaveBeenCalledWith(5, {
      transaction: TRANSACTION,
    });
  });

  it("lists the allocations ordered ascending without the author by default", async () => {
    const rows = [{ id: 11 }];
    PaymentAllocation.findAll.mockResolvedValue(rows);

    await expect(repository.listAllocations(1)).resolves.toBe(rows);
    expect(PaymentAllocation.findAll).toHaveBeenCalledWith({
      where: { invoice_id: 1 },
      order: LIST_ORDER,
      include: [expect.objectContaining({ as: "payment" })],
    });
  });

  it("includes the staff author on demand", async () => {
    PaymentAllocation.findAll.mockResolvedValue([]);

    await repository.listAllocations(1, { includeCreatedBy: true });

    const options = PaymentAllocation.findAll.mock.calls[0][0];
    expect(options.include).toHaveLength(2);
    expect(options.include[1]).toMatchObject({
      model: User,
      as: "created_by",
    });
  });

  it("accepts injected models and connection", async () => {
    const connection = { transaction: jest.fn() };
    const injected = createInvoicePaymentRepository({
      connection,
      currencyModel: { findByPk: jest.fn() },
    });

    await injected.transaction(() => "done");

    expect(connection.transaction).toHaveBeenCalled();
  });
});
