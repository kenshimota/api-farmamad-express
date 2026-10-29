jest.mock("../models/purchase", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/purchase-item", () => ({
  create: jest.fn(),
  bulkCreate: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../models/supplier", () => ({ findByPk: jest.fn() }));
jest.mock("../models/product", () => ({ findByPk: jest.fn() }));
jest.mock("../models/item-state", () => ({ findByPk: jest.fn() }));
jest.mock("../models/cost", () => ({ upsert: jest.fn() }));
jest.mock("../models/currency", () => ({}));
jest.mock("../database", () => ({
  transaction: jest.fn(),
  query: jest.fn(),
}));

const { QueryTypes } = require("sequelize");
const db = require("../database");
const Purchase = require("../models/purchase");
const PurchaseItem = require("../models/purchase-item");
const Supplier = require("../models/supplier");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const Cost = require("../models/cost");
const Currency = require("../models/currency");
const {
  CURRENCY_INCLUDE,
  ITEM_INCLUDE,
  LIST_ORDER,
  SUPPLIER_INCLUDE,
  buildListOptions,
  createPurchaseRepository,
} = require("./repository");

const repository = createPurchaseRepository();
const VALUES = {
  number: 1,
  supplier_id: 2,
  status: "draft",
  subtotal: "0.00",
  tax_amount: "0.00",
  total: "0.00",
};
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("buildListOptions", () => {
  it("orders by number descending without filters", () => {
    expect(buildListOptions()).toEqual({
      order: LIST_ORDER,
      include: [CURRENCY_INCLUDE],
    });
  });

  it("combines every exact filter and includes the items on demand", () => {
    expect(
      buildListOptions({
        supplierId: 2,
        status: "confirmed",
        number: 7,
        currencyId: 3,
        includeItems: true,
      }),
    ).toEqual({
      order: LIST_ORDER,
      where: { supplier_id: 2, status: "confirmed", number: 7, currency_id: 3 },
      include: [CURRENCY_INCLUDE, ITEM_INCLUDE],
    });
  });
});

describe("purchaseRepository", () => {
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
      "SELECT nextval('purchases_number_seq') AS \"number\"",
      { type: QueryTypes.SELECT, transaction: TRANSACTION },
    );
  });

  it("creates, updates and removes purchases", async () => {
    const created = { id: 1, ...VALUES };
    const updated = { id: 1 };
    const purchase = {
      update: jest.fn().mockResolvedValue(updated),
      destroy: jest.fn().mockResolvedValue(),
    };
    Purchase.create.mockResolvedValue(created);

    await expect(
      repository.create(VALUES, { transaction: TRANSACTION }),
    ).resolves.toBe(created);
    await expect(
      repository.update(
        purchase,
        { notes: "x" },
        {
          transaction: TRANSACTION,
        },
      ),
    ).resolves.toBe(updated);
    await expect(
      repository.remove(purchase, { transaction: TRANSACTION }),
    ).resolves.toBeUndefined();

    expect(Purchase.create).toHaveBeenCalledWith(VALUES, {
      transaction: TRANSACTION,
    });
    expect(purchase.update).toHaveBeenCalledWith(
      { notes: "x" },
      { transaction: TRANSACTION },
    );
    expect(purchase.destroy).toHaveBeenCalledWith({
      transaction: TRANSACTION,
    });
  });

  it("lists purchases with the built options", async () => {
    const rows = [{ id: 1 }];
    Purchase.findAll.mockResolvedValue(rows);

    await expect(repository.list({ status: "draft" })).resolves.toBe(rows);
    expect(Purchase.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      where: { status: "draft" },
      include: [CURRENCY_INCLUDE],
    });
  });

  it("finds a purchase with items and supplier on demand", async () => {
    const purchase = { id: 1 };
    Purchase.findByPk.mockResolvedValue(purchase);

    await expect(
      repository.findById(1, {
        includeItems: true,
        includeSupplier: true,
        transaction: TRANSACTION,
      }),
    ).resolves.toBe(purchase);
    expect(Purchase.findByPk).toHaveBeenCalledWith(1, {
      include: [CURRENCY_INCLUDE, ITEM_INCLUDE, SUPPLIER_INCLUDE],
      transaction: TRANSACTION,
      lock: undefined,
    });

    await repository.findById(2);
    expect(Purchase.findByPk).toHaveBeenLastCalledWith(2, {
      include: [CURRENCY_INCLUDE],
      transaction: undefined,
      lock: undefined,
    });
  });

  it("locks the purchase row for update", async () => {
    Purchase.findByPk.mockResolvedValue({ id: 1 });

    await repository.findByIdForUpdate(1, TRANSACTION);

    expect(Purchase.findByPk).toHaveBeenCalledWith(1, {
      transaction: TRANSACTION,
      lock: "UPDATE",
    });
  });

  it.each([
    ["supplierExists", Supplier, "supplier"],
    ["productExists", Product, "product"],
    ["itemStateExists", ItemState, "item state"],
  ])("tells whether the %s row exists", async (method, model) => {
    model.findByPk.mockResolvedValueOnce({ id: 1 });
    model.findByPk.mockResolvedValueOnce(null);

    await expect(repository[method](1)).resolves.toBe(true);
    await expect(repository[method](99)).resolves.toBe(false);
  });

  it("upserts the current cost with the given transaction", async () => {
    Cost.upsert.mockResolvedValue([{ id: 1 }, true]);

    await repository.upsertCost(
      {
        product_id: 15,
        item_state_id: 1,
        unit_cost: "20.00",
        currency_id: 3,
      },
      { transaction: TRANSACTION },
    );

    expect(Cost.upsert).toHaveBeenCalledWith(
      {
        product_id: 15,
        item_state_id: 1,
        cost: "20.00",
        currency_id: 3,
      },
      {
        transaction: TRANSACTION,
        conflictFields: ["product_id", "item_state_id"],
      },
    );
  });

  it("uses injected models and database", async () => {
    const model = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(null),
    };
    const injectedDb = { transaction: jest.fn(), query: jest.fn() };
    const injected = createPurchaseRepository({
      model,
      itemModel: { ...PurchaseItem },
      supplierModel: Supplier,
      productModel: Product,
      itemStateModel: ItemState,
      costModel: Cost,
      db: injectedDb,
    });

    await injected.create(VALUES);
    await injected.list();

    expect(model.create).toHaveBeenCalledWith(VALUES, {
      transaction: undefined,
    });
    expect(model.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: [CURRENCY_INCLUDE],
    });
    expect(Purchase.create).not.toHaveBeenCalled();
  });
});
