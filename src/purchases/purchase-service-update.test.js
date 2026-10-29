const Currency = require("../models/currency");
const { createPurchaseService } = require("./purchase-service");
const {
  TRANSACTION,
  itemRepositoryDouble,
  repositoryDouble,
  stocksDouble,
} = require("../../test/helpers/purchase-service-doubles");

const ORIGINAL_TAX_RATE = process.env.PURCHASE_TAX_RATE;

/**
 * Builds the service with fresh doubles.
 * @param {object} [overrides] - Dependency overrides.
 * @returns {object} The service and its doubles.
 */
function setup(overrides = {}) {
  const repository = overrides.repository ?? repositoryDouble();
  const itemRepository = overrides.itemRepository ?? itemRepositoryDouble();
  const stocks = overrides.stocks ?? stocksDouble();
  const clock = overrides.clock ?? (() => new Date("2026-10-29T10:00:00Z"));
  const service = createPurchaseService({
    repository,
    itemRepository,
    stocks,
    clock,
  });

  return { service, repository, itemRepository, stocks, clock };
}

/**
 * Builds a stored purchase.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Purchase double.
 */
function purchase(overrides = {}) {
  return {
    id: 1,
    number: 1,
    supplier_id: 2,
    status: "draft",
    subtotal: "0.00",
    tax_rate: "16.00",
    tax_amount: "0.00",
    total: "0.00",
    notes: null,
    confirmed_at: null,
    ...overrides,
  };
}

afterEach(() => {
  if (ORIGINAL_TAX_RATE === undefined) {
    delete process.env.PURCHASE_TAX_RATE;
  } else {
    process.env.PURCHASE_TAX_RATE = ORIGINAL_TAX_RATE;
  }
});

describe("updatePurchase", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("recalculates the totals with the new tax rate", async () => {
    const { service, repository, itemRepository } = setup();
    const stored = purchase();
    repository.findByIdForUpdate.mockResolvedValue(stored);
    repository.findById.mockResolvedValue(stored);
    itemRepository.list.mockResolvedValue([
      { quantity: 2, unit_cost: "10.00" },
    ]);

    await service.updatePurchase(1, { tax_rate: 8.25, notes: "Nueva" });

    expect(repository.update).toHaveBeenCalledWith(
      stored,
      {
        tax_rate: "8.25",
        notes: "Nueva",
        subtotal: "20.00",
        tax_amount: "1.65",
        total: "21.65",
      },
      { transaction: TRANSACTION },
    );
  });

  it("validates and changes the currency without converting the totals", async () => {
    const { service, repository, itemRepository } = setup();
    const stored = purchase();
    const other = { id: 7, code: "VES", name: "Bolívar", symbol: "Bs" };
    jest.spyOn(Currency, "findOne").mockResolvedValue(other);
    repository.findByIdForUpdate.mockResolvedValue(stored);
    itemRepository.list.mockResolvedValue([
      { quantity: 2, unit_cost: "10.00" },
    ]);

    await service.updatePurchase(1, { currency_id: 7 });

    expect(repository.update).toHaveBeenCalledWith(
      stored,
      expect.objectContaining({ currency_id: 7, subtotal: "20.00" }),
      { transaction: TRANSACTION },
    );
  });

  it("rejects an invalid currency on update", async () => {
    const { service, repository } = setup();
    jest.spyOn(Currency, "findOne").mockResolvedValue(null);
    repository.findByIdForUpdate.mockResolvedValue(purchase());

    await expect(
      service.updatePurchase(1, { currency_id: 99 }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { currency_id: "Invalid currency" } },
    });
  });

  it("validates a changed supplier", async () => {
    const { service, repository } = setup();
    repository.findByIdForUpdate.mockResolvedValue(purchase());
    repository.supplierExists.mockResolvedValue(false);

    await expect(
      service.updatePurchase(1, { supplier_id: 99 }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { supplier_id: "Invalid supplier id" } },
    });
  });

  it("answers 404 and 409 for missing and non-draft purchases", async () => {
    const { service, repository } = setup();
    repository.findByIdForUpdate.mockResolvedValueOnce(null);

    await expect(
      service.updatePurchase(99, { notes: "x" }),
    ).rejects.toMatchObject({ status: 404 });

    repository.findByIdForUpdate.mockResolvedValueOnce(
      purchase({ status: "confirmed" }),
    );

    await expect(
      service.updatePurchase(1, { notes: "x" }),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Purchase is not editable" },
    });
  });
});

describe("deletePurchase and cancelPurchase", () => {
  it("deletes a draft", async () => {
    const { service, repository } = setup();
    const stored = purchase();
    repository.findByIdForUpdate.mockResolvedValue(stored);

    await expect(service.deletePurchase(1)).resolves.toBeUndefined();
    expect(repository.remove).toHaveBeenCalledWith(stored, {
      transaction: TRANSACTION,
    });
  });

  it("cancels a draft without touching costs or stocks", async () => {
    const { service, repository, stocks } = setup();
    const stored = purchase();
    repository.findByIdForUpdate.mockResolvedValue(stored);
    repository.findById.mockResolvedValue(stored);

    await service.cancelPurchase(1);

    expect(repository.update).toHaveBeenCalledWith(
      stored,
      { status: "cancelled" },
      { transaction: TRANSACTION },
    );
    expect(repository.upsertCost).not.toHaveBeenCalled();
    expect(stocks.applyPurchaseItems).not.toHaveBeenCalled();
  });

  it("rejects deleting or cancelling a non-draft purchase", async () => {
    const { service, repository } = setup();
    repository.findByIdForUpdate
      .mockResolvedValueOnce(purchase({ status: "confirmed" }))
      .mockResolvedValueOnce(purchase({ status: "cancelled" }));

    await expect(service.deletePurchase(1)).rejects.toMatchObject({
      status: 409,
    });
    await expect(service.cancelPurchase(1)).rejects.toMatchObject({
      status: 409,
    });
  });
});
