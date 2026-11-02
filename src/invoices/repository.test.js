jest.mock("../models/invoice", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../models/invoice-item", () => ({ bulkCreate: jest.fn() }));
jest.mock("../models/customer", () => ({}));
jest.mock("../models/currency", () => ({}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("../models/payment-allocation", () => ({}));
jest.mock("../models/payment", () => ({}));
jest.mock("../database", () => ({
  transaction: jest.fn(),
  query: jest.fn(),
}));

const { QueryTypes } = require("sequelize");
const db = require("../database");
const Invoice = require("../models/invoice");
const InvoiceItem = require("../models/invoice-item");
const User = require("../models/user");
const {
  CURRENCY_INCLUDE,
  CUSTOMER_INCLUDE,
  INVOICED_BY_INCLUDE,
  ITEM_INCLUDE,
  LIST_ORDER,
  PAYMENT_ALLOCATION_INCLUDE,
  buildListOptions,
  createInvoiceRepository,
} = require("./repository");

const repository = createInvoiceRepository();
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const VALUES = {
  number: 1,
  order_id: 10,
  customer_id: 8,
  invoiced_by_user_id: 1,
  currency_id: 3,
  subtotal: "25.00",
  tax_amount: "0.00",
  total: "25.00",
  paid_amount: "0.00",
  payment_status: "pending",
  issued_at: new Date("2026-11-01T12:00:00.000Z"),
  due_date: "2026-11-16",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("buildListOptions", () => {
  it("orders by issued_at and id descending without filters", () => {
    expect(buildListOptions()).toEqual({
      order: LIST_ORDER,
      include: [CUSTOMER_INCLUDE, CURRENCY_INCLUDE],
    });
  });

  it("combines every exact filter and includes the items on demand", () => {
    expect(
      buildListOptions({
        orderId: 10,
        customerId: 8,
        number: 1,
        paymentStatus: "paid",
        includeItems: true,
      }),
    ).toEqual({
      order: LIST_ORDER,
      where: {
        order_id: 10,
        customer_id: 8,
        number: 1,
        payment_status: "paid",
      },
      include: [CUSTOMER_INCLUDE, CURRENCY_INCLUDE, ITEM_INCLUDE],
    });
  });
});

describe("invoiceRepository", () => {
  it("runs the callback inside a transaction", async () => {
    db.transaction.mockImplementation((callback) => callback(TRANSACTION));

    await expect(
      repository.transaction(async (transaction) => transaction),
    ).resolves.toBe(TRANSACTION);
  });

  it("reserves the next number through sequelize.query", async () => {
    db.query.mockResolvedValue([{ number: "9" }]);

    await expect(repository.nextNumber(TRANSACTION)).resolves.toBe(9);
    expect(db.query).toHaveBeenCalledWith(
      "SELECT nextval('invoices_number_seq') AS \"number\"",
      { type: QueryTypes.SELECT, transaction: TRANSACTION },
    );
  });

  it("creates invoices and their lines", async () => {
    const invoice = { id: 1, ...VALUES };
    const rows = [{ invoice_id: 1, product_id: 15 }];
    Invoice.create.mockResolvedValue(invoice);
    InvoiceItem.bulkCreate.mockResolvedValue(rows);

    await expect(
      repository.create(VALUES, { transaction: TRANSACTION }),
    ).resolves.toBe(invoice);
    await expect(
      repository.createItems(rows, { transaction: TRANSACTION }),
    ).resolves.toBe(rows);

    expect(Invoice.create).toHaveBeenCalledWith(VALUES, {
      transaction: TRANSACTION,
    });
    expect(InvoiceItem.bulkCreate).toHaveBeenCalledWith(rows, {
      transaction: TRANSACTION,
    });
  });

  it("lists invoices with the built options", async () => {
    const rows = [{ id: 1 }];
    Invoice.findAll.mockResolvedValue(rows);

    await expect(repository.list({ paymentStatus: "paid" })).resolves.toBe(
      rows,
    );
    expect(Invoice.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      where: { payment_status: "paid" },
      include: [CUSTOMER_INCLUDE, CURRENCY_INCLUDE],
    });
  });

  it("finds an invoice with its relations on demand", async () => {
    const invoice = { id: 1 };
    Invoice.findByPk.mockResolvedValue(invoice);

    await expect(
      repository.findById(1, {
        includeItems: true,
        includeInvoicedBy: true,
        includePayments: true,
        transaction: TRANSACTION,
      }),
    ).resolves.toBe(invoice);
    expect(Invoice.findByPk).toHaveBeenCalledWith(1, {
      include: [
        CUSTOMER_INCLUDE,
        CURRENCY_INCLUDE,
        ITEM_INCLUDE,
        INVOICED_BY_INCLUDE,
        PAYMENT_ALLOCATION_INCLUDE,
      ],
      transaction: TRANSACTION,
      lock: undefined,
    });

    await repository.findById(2);
    expect(Invoice.findByPk).toHaveBeenLastCalledWith(2, {
      include: [CUSTOMER_INCLUDE, CURRENCY_INCLUDE],
      transaction: undefined,
      lock: undefined,
    });
  });

  it("finds the invoice of an order", async () => {
    const invoice = { id: 1 };
    Invoice.findOne.mockResolvedValue(invoice);

    await expect(
      repository.findByOrderId(10, {
        includeItems: true,
        transaction: TRANSACTION,
      }),
    ).resolves.toBe(invoice);
    expect(Invoice.findOne).toHaveBeenCalledWith({
      where: { order_id: 10 },
      include: [CUSTOMER_INCLUDE, CURRENCY_INCLUDE, ITEM_INCLUDE],
      transaction: TRANSACTION,
      lock: undefined,
    });
  });

  it("tells whether an order already has an invoice", async () => {
    Invoice.findOne.mockResolvedValueOnce({ id: 1 });
    Invoice.findOne.mockResolvedValueOnce(null);

    await expect(repository.hasOrderInvoice(10)).resolves.toBe(true);
    await expect(repository.hasOrderInvoice(11)).resolves.toBe(false);
    expect(Invoice.findOne).toHaveBeenLastCalledWith({
      where: { order_id: 11 },
      attributes: ["id"],
      transaction: undefined,
      lock: undefined,
    });
  });

  it("loads the authenticated actor from users", async () => {
    const user = { id: 1, customer_id: 8 };
    User.findByPk.mockResolvedValue(user);

    await expect(repository.findUserById(1, TRANSACTION)).resolves.toBe(user);
    expect(User.findByPk).toHaveBeenCalledWith(1, {
      transaction: TRANSACTION,
    });
  });

  it("uses injected models and database", async () => {
    const model = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const itemModel = { bulkCreate: jest.fn().mockResolvedValue([]) };
    const userModel = { findByPk: jest.fn().mockResolvedValue(null) };
    const injectedDb = { transaction: jest.fn(), query: jest.fn() };
    const injected = createInvoiceRepository({
      model,
      itemModel,
      userModel,
      db: injectedDb,
    });

    await injected.create(VALUES);
    await injected.createItems([]);
    await injected.list();
    await injected.findUserById(1);

    expect(model.create).toHaveBeenCalledWith(VALUES, {
      transaction: undefined,
    });
    expect(itemModel.bulkCreate).toHaveBeenCalledWith([], {
      transaction: undefined,
    });
    expect(model.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: [CUSTOMER_INCLUDE, CURRENCY_INCLUDE],
    });
    expect(userModel.findByPk).toHaveBeenCalledWith(1, {
      transaction: undefined,
    });
    expect(Invoice.create).not.toHaveBeenCalled();
  });
});
