const { Op } = require("sequelize");
const {
  LIST_ORDER,
  LOT_INCLUDES,
  createLotRepository,
  expirationCondition,
} = require("./repository");

/**
 * Builds model doubles and a repository around them.
 * @returns {object} The repository and its doubles.
 */
function buildRepository() {
  const model = {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  };
  const productModel = { findByPk: jest.fn() };
  const itemStateModel = { findByPk: jest.fn() };
  const warehouseModel = { findByPk: jest.fn() };
  const shelfModel = { findByPk: jest.fn() };
  const sectionModel = { findByPk: jest.fn() };
  const connection = { transaction: jest.fn() };
  const repository = createLotRepository({
    model,
    productModel,
    itemStateModel,
    warehouseModel,
    shelfModel,
    sectionModel,
    connection,
  });

  return {
    repository,
    model,
    productModel,
    itemStateModel,
    warehouseModel,
    shelfModel,
    sectionModel,
    connection,
  };
}

describe("lot repository", () => {
  it("delegates transactions and creates", async () => {
    const { repository, model, connection } = buildRepository();
    const callback = jest.fn();
    connection.transaction.mockReturnValue("transaction result");
    model.create.mockResolvedValue({ id: 1 });

    expect(repository.transaction(callback)).toBe("transaction result");
    expect(connection.transaction).toHaveBeenCalledWith(callback);

    await expect(
      repository.create({ number: "L-1" }, { tx: true }),
    ).resolves.toEqual({ id: 1 });
    expect(model.create).toHaveBeenCalledWith({ number: "L-1" }, { tx: true });
  });

  it("loads a lot with the five documented includes", async () => {
    const { repository, model } = buildRepository();
    model.findByPk.mockResolvedValue({ id: 1 });

    await repository.findById(1, { transaction: "tx" });

    expect(model.findByPk).toHaveBeenCalledWith(1, {
      transaction: "tx",
      include: LOT_INCLUDES,
    });
    expect(LOT_INCLUDES.map((include) => include.as)).toEqual([
      "product",
      "item_state",
      "warehouse",
      "shelf",
      "section",
    ]);
  });

  it("looks up duplicates ignoring case and can exclude the current lot", async () => {
    const { repository, model } = buildRepository();

    await repository.findDuplicate(
      { productId: 15, number: "l-1" },
      { transaction: "tx" },
    );
    expect(model.findOne).toHaveBeenLastCalledWith({
      where: {
        product_id: 15,
        number: { [Op.iLike]: "l-1" },
      },
      transaction: "tx",
    });

    await repository.findDuplicate({
      productId: 15,
      number: "l-1",
      excludeId: 3,
    });
    expect(model.findOne).toHaveBeenLastCalledWith({
      where: {
        product_id: 15,
        number: { [Op.iLike]: "l-1" },
        id: { [Op.ne]: 3 },
      },
    });
  });

  it("lists without filters and with every documented filter", async () => {
    const { repository, model } = buildRepository();

    await repository.list();
    expect(model.findAll).toHaveBeenLastCalledWith({
      order: LIST_ORDER,
      include: LOT_INCLUDES,
    });

    await repository.list({
      productId: 1,
      itemStateId: 2,
      warehouseId: 3,
      shelfId: 4,
      sectionId: 5,
      number: "L-1",
      expired: true,
      expiringBefore: "2027-01-01",
    });
    const query = model.findAll.mock.calls.at(-1)[0];

    expect(query.where).toMatchObject({
      product_id: 1,
      item_state_id: 2,
      warehouse_id: 3,
      shelf_id: 4,
      section_id: 5,
      number: { [Op.iLike]: "L-1" },
    });
    expect(query.where.expiration_date[Op.and]).toHaveLength(2);
  });

  it("updates, removes and checks references", async () => {
    const {
      repository,
      model,
      productModel,
      itemStateModel,
      warehouseModel,
      shelfModel,
      sectionModel,
    } = buildRepository();
    const lot = {
      update: jest.fn().mockResolvedValue(),
      destroy: jest.fn().mockResolvedValue(),
    };
    productModel.findByPk.mockResolvedValue({ id: 1 });
    itemStateModel.findByPk.mockResolvedValue({ id: 2 });
    warehouseModel.findByPk.mockResolvedValue({ id: 3 });
    shelfModel.findByPk.mockResolvedValue({ id: 4 });
    sectionModel.findByPk.mockResolvedValue(null);

    await repository.update(lot, { stock: 1 }, { transaction: "tx" });
    expect(lot.update).toHaveBeenCalledWith(
      { stock: 1 },
      { transaction: "tx" },
    );

    await repository.remove(lot, { transaction: "tx" });
    expect(lot.destroy).toHaveBeenCalledWith({ transaction: "tx" });

    await expect(repository.productExists(1)).resolves.toBe(true);
    await expect(repository.itemStateExists(2)).resolves.toBe(true);
    await expect(repository.warehouseExists(3)).resolves.toBe(true);
    await expect(repository.findShelf(4)).resolves.toEqual({ id: 4 });
    await expect(repository.findSection(5)).resolves.toBeNull();
    expect(model.findByPk).not.toHaveBeenCalled();
  });

  it("builds expiration conditions from expired and before date", () => {
    expect(expirationCondition({})).toBeNull();
    expect(expirationCondition({ expired: false })).toEqual({
      [Op.gte]: expect.anything(),
    });
    expect(expirationCondition({ expiringBefore: "2027-01-01" })).toEqual({
      [Op.lte]: "2027-01-01",
    });
    expect(
      expirationCondition({ expired: true, expiringBefore: "2027-01-01" })[
        Op.and
      ],
    ).toHaveLength(2);
  });
});
