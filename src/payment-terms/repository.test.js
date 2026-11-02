jest.mock("../models/payment-term", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/customer", () => ({ count: jest.fn() }));
jest.mock("../models/order", () => ({ count: jest.fn() }));
jest.mock("../models/invoice", () => ({ count: jest.fn() }));

const PaymentTerm = require("../models/payment-term");
const Customer = require("../models/customer");
const Order = require("../models/order");
const Invoice = require("../models/invoice");
const { LIST_ORDER, createPaymentTermRepository } = require("./repository");

const repository = createPaymentTermRepository();
const VALUES = {
  code: "credit_30",
  name: "Crédito 30 días",
  description: null,
  days: 30,
  is_active: true,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("paymentTermRepository", () => {
  it("creates, loads and updates terms", async () => {
    const term = { id: 4, update: jest.fn().mockResolvedValue({ id: 4 }) };
    PaymentTerm.create.mockResolvedValue(term);
    PaymentTerm.findByPk.mockResolvedValue(term);

    await expect(repository.create(VALUES)).resolves.toBe(term);
    await expect(repository.findById(4)).resolves.toBe(term);
    await expect(repository.update(term, { days: 45 })).resolves.toBeDefined();

    expect(PaymentTerm.create).toHaveBeenCalledWith(VALUES);
    expect(PaymentTerm.findByPk).toHaveBeenCalledWith(4);
    expect(term.update).toHaveBeenCalledWith({ days: 45 });
  });

  it("lists by days and id ascending without a filter", async () => {
    const rows = [{ id: 1 }];
    PaymentTerm.findAll.mockResolvedValue(rows);

    await expect(repository.list()).resolves.toBe(rows);
    expect(PaymentTerm.findAll).toHaveBeenCalledWith({ order: LIST_ORDER });
  });

  it("filters by is_active when provided", async () => {
    PaymentTerm.findAll.mockResolvedValue([]);

    await repository.list({ isActive: false });

    expect(PaymentTerm.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      where: { is_active: false },
    });
  });

  it("removes a term through the instance", async () => {
    const term = { destroy: jest.fn().mockResolvedValue() };

    await repository.remove(term);

    expect(term.destroy).toHaveBeenCalledTimes(1);
  });

  it("detects usage in customers, orders or invoices", async () => {
    Customer.count.mockResolvedValue(0);
    Order.count.mockResolvedValue(0);
    Invoice.count.mockResolvedValue(1);

    await expect(repository.isInUse(2)).resolves.toBe(true);
    expect(Customer.count).toHaveBeenCalledWith({
      where: { payment_term_id: 2 },
    });
    expect(Order.count).toHaveBeenCalledWith({
      where: { payment_term_id: 2 },
    });
    expect(Invoice.count).toHaveBeenCalledWith({
      where: { payment_term_id: 2 },
    });

    Invoice.count.mockResolvedValue(0);
    await expect(repository.isInUse(2)).resolves.toBe(false);
  });
});
