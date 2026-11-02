const {
  createPurchaseLotService,
  toDateOnly,
} = require("./purchase-lot-service");

const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const LINE = {
  product_id: 15,
  item_state_id: 1,
  quantity: 10,
  lot_number: "LOTE-1",
  expiration_date: "2027-03-31",
};

/**
 * Builds a lot model double.
 * @returns {object} The model double.
 */
function lotModelDouble() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn(async (values) => ({ id: 40, ...values })),
  };
}

describe("purchase lot service", () => {
  it("creates a pending lot without location on the first receipt", async () => {
    const lotModel = lotModelDouble();
    const service = createPurchaseLotService({ lotModel });

    const lot = await service.receiveLine(LINE, TRANSACTION);

    expect(lotModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ product_id: 15 }),
        transaction: TRANSACTION,
        lock: "UPDATE",
      }),
    );
    expect(lotModel.create).toHaveBeenCalledWith(
      {
        number: "LOTE-1",
        product_id: 15,
        expiration_date: "2027-03-31",
        item_state_id: 1,
        stock: 10,
        reserved: 0,
        location_status: "pending",
        warehouse_id: null,
        shelf_id: null,
        section_id: null,
        location_started_at: null,
        location_started_by: null,
        located_at: null,
        located_by: null,
      },
      { transaction: TRANSACTION },
    );
    expect(lot.id).toBe(40);
  });

  it("increments the stock of a matching existing lot", async () => {
    const lotModel = lotModelDouble();
    const existing = {
      id: 7,
      item_state_id: 1,
      expiration_date: "2027-03-31",
      stock: 5,
      update: jest.fn(async (values) => ({ id: 7, ...values })),
    };

    lotModel.findOne.mockResolvedValue(existing);
    const service = createPurchaseLotService({ lotModel });

    const lot = await service.receiveLine(LINE, TRANSACTION);

    expect(existing.update).toHaveBeenCalledWith(
      { stock: 15 },
      { transaction: TRANSACTION },
    );
    expect(lotModel.create).not.toHaveBeenCalled();
    expect(lot.id).toBe(7);
  });

  it("rejects an existing lot with another state or expiration", async () => {
    const service = createPurchaseLotService({
      lotModel: {
        findOne: jest.fn().mockResolvedValue({
          id: 7,
          item_state_id: 2,
          expiration_date: "2027-03-31",
          stock: 5,
          update: jest.fn(),
        }),
        create: jest.fn(),
      },
    });

    await expect(service.receiveLine(LINE, TRANSACTION)).rejects.toMatchObject({
      status: 409,
      body: { message: "Lot already exists with different data" },
    });
  });

  it("normalizes DATEONLY values", () => {
    expect(toDateOnly("2027-03-31")).toBe("2027-03-31");
    expect(toDateOnly(new Date("2027-03-31T12:00:00Z"))).toBe("2027-03-31");
    expect(toDateOnly(null)).toBeNull();
  });
});
