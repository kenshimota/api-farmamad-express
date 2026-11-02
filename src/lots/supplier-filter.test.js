jest.mock("../models/purchase-item", () => ({ findAll: jest.fn() }));
jest.mock("../models/purchase", () => ({}));

const { Op } = require("sequelize");
const PurchaseItem = require("../models/purchase-item");
const { filterBySupplier } = require("./supplier-filter");

const OPTIONS = { order: [["id", "ASC"]] };

beforeEach(() => {
  PurchaseItem.findAll.mockReset();
});

describe("filterBySupplier", () => {
  it("delegates to findAll when no supplier is requested", async () => {
    const model = { findAll: jest.fn().mockResolvedValue([]) };

    await expect(
      filterBySupplier(model, OPTIONS, { enabled: false }, undefined),
    ).resolves.toEqual([]);
    expect(model.findAll).toHaveBeenCalledWith(OPTIONS);
    expect(PurchaseItem.findAll).not.toHaveBeenCalled();
  });

  it("restricts the listing to the received lot ids of the supplier", async () => {
    const model = { findAll: jest.fn().mockResolvedValue([]) };
    PurchaseItem.findAll.mockResolvedValue([
      { received_lot_id: 1 },
      { received_lot_id: 2 },
      { received_lot_id: 1 },
    ]);

    await filterBySupplier(model, { ...OPTIONS }, { enabled: false }, 7);

    expect(PurchaseItem.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: ["received_lot_id"],
        raw: true,
        include: [
          expect.objectContaining({
            as: "purchase",
            required: true,
            where: { supplier_id: 7 },
          }),
        ],
      }),
    );
    expect(model.findAll).toHaveBeenCalledWith({
      ...OPTIONS,
      where: { id: { [Op.in]: [1, 2] } },
    });
  });

  it("uses the paginated count when pagination is requested", async () => {
    const model = {
      findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }),
    };
    PurchaseItem.findAll.mockResolvedValue([]);

    await filterBySupplier(
      model,
      { ...OPTIONS },
      { enabled: true, page: 1, pageSize: 10 },
      7,
    );

    expect(model.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { [Op.in]: [] } },
        limit: 10,
        offset: 0,
      }),
    );
  });
});
