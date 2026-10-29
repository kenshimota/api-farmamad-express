jest.mock("../models/purchase-item", () => ({
  create: jest.fn(),
  bulkCreate: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
}));

const { Op } = require("sequelize");
const PurchaseItem = require("../models/purchase-item");
const {
  ITEM_ORDER,
  createPurchaseItemRepository,
} = require("./item-repository");

const repository = createPurchaseItemRepository();
const TRANSACTION = { id: "tx" };
const VALUES = {
  purchase_id: 1,
  product_id: 15,
  item_state_id: 1,
  quantity: 2,
  unit_cost: "10.00",
  subtotal: "20.00",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("purchaseItemRepository", () => {
  it("bulk creates lines inside the transaction", async () => {
    const created = [{ id: 1 }];
    PurchaseItem.bulkCreate.mockResolvedValue(created);

    await expect(
      repository.createMany([VALUES], { transaction: TRANSACTION }),
    ).resolves.toBe(created);
    expect(PurchaseItem.bulkCreate).toHaveBeenCalledWith([VALUES], {
      transaction: TRANSACTION,
      returning: true,
    });
  });

  it("creates one line inside the transaction", async () => {
    const created = { id: 1, ...VALUES };
    PurchaseItem.create.mockResolvedValue(created);

    await expect(
      repository.create(VALUES, { transaction: TRANSACTION }),
    ).resolves.toBe(created);
    expect(PurchaseItem.create).toHaveBeenCalledWith(VALUES, {
      transaction: TRANSACTION,
    });
  });

  it("lists the lines of a purchase ordered by id", async () => {
    const rows = [{ id: 1 }];
    PurchaseItem.findAll.mockResolvedValue(rows);

    await expect(repository.list(1)).resolves.toBe(rows);
    expect(PurchaseItem.findAll).toHaveBeenCalledWith({
      where: { purchase_id: 1 },
      order: ITEM_ORDER,
      transaction: undefined,
    });
  });

  it("finds one line of a purchase with an optional lock", async () => {
    const item = { id: 4 };
    PurchaseItem.findOne.mockResolvedValue(item);

    await expect(
      repository.findById(1, 4, { transaction: TRANSACTION, lock: "UPDATE" }),
    ).resolves.toBe(item);
    expect(PurchaseItem.findOne).toHaveBeenCalledWith({
      where: { id: 4, purchase_id: 1 },
      transaction: TRANSACTION,
      lock: "UPDATE",
    });
  });

  it("finds the unique combination excluding the edited line", async () => {
    PurchaseItem.findOne.mockResolvedValue(null);

    await expect(
      repository.findByCombination(1, 15, 2, {
        excludeId: 4,
        transaction: TRANSACTION,
      }),
    ).resolves.toBeNull();
    expect(PurchaseItem.findOne).toHaveBeenCalledWith({
      where: {
        purchase_id: 1,
        product_id: 15,
        item_state_id: 2,
        id: { [Op.ne]: 4 },
      },
      transaction: TRANSACTION,
    });

    await repository.findByCombination(1, 15, 2);

    expect(PurchaseItem.findOne).toHaveBeenLastCalledWith({
      where: {
        purchase_id: 1,
        product_id: 15,
        item_state_id: 2,
      },
      transaction: undefined,
    });
  });

  it("updates and removes a loaded line", async () => {
    const updated = { id: 1 };
    const item = {
      update: jest.fn().mockResolvedValue(updated),
      destroy: jest.fn().mockResolvedValue(),
    };

    await expect(
      repository.update(
        item,
        { quantity: 3 },
        {
          transaction: TRANSACTION,
        },
      ),
    ).resolves.toBe(updated);
    await expect(
      repository.remove(item, { transaction: TRANSACTION }),
    ).resolves.toBeUndefined();

    expect(item.update).toHaveBeenCalledWith(
      { quantity: 3 },
      { transaction: TRANSACTION },
    );
    expect(item.destroy).toHaveBeenCalledWith({
      transaction: TRANSACTION,
    });
  });

  it("uses an injected model", async () => {
    const itemModel = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      bulkCreate: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const injected = createPurchaseItemRepository({ itemModel });

    await injected.create(VALUES);
    await injected.list(1);

    expect(itemModel.create).toHaveBeenCalledWith(VALUES, {
      transaction: undefined,
    });
    expect(PurchaseItem.create).not.toHaveBeenCalled();
  });
});
