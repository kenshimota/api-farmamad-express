jest.mock("./repository", () => ({
  createExpireLotsRepository: jest.fn(() => ({ default: true })),
}));

const logger = require("../../config/logger");
const { ExpiredItemStateNotFoundError } = require("./errors");
const { TRANSACTION, lot, setup } = require("./expire-lots.fixtures");
const { runExpireLotsJob } = require("./service");

beforeEach(() => {
  jest.spyOn(logger, "info").mockImplementation(() => {});
  jest.spyOn(logger, "warn").mockImplementation(() => {});
  jest.spyOn(logger, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("runExpireLotsJob", () => {
  it("returns locked: false and performs no writes when the lock is busy", async () => {
    const { repository } = setup({ locked: false });

    const summary = await runExpireLotsJob({ repository, batchSize: 500 });

    expect(summary).toEqual(
      expect.objectContaining({
        candidates: 0,
        moved: 0,
        skipped_reserved: [],
        affected_products: 0,
        stock_rows_updated: 0,
        expired_item_state_id: null,
        locked: false,
        dry_run: false,
        errors: [],
      }),
    );
    expect(repository.findExpiredItemState).not.toHaveBeenCalled();
    expect(repository.findCandidates).not.toHaveBeenCalled();
    expect(repository.moveToExpired).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("lock"),
      expect.any(Object),
    );
  });

  it("fails without touching lots when the expired state is missing", async () => {
    const { repository } = setup({ expired: null });

    await expect(runExpireLotsJob({ repository })).rejects.toBeInstanceOf(
      ExpiredItemStateNotFoundError,
    );
    expect(repository.findCandidates).not.toHaveBeenCalled();
    expect(repository.moveToExpired).not.toHaveBeenCalled();
    expect(repository.recalculateStock).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ stack: expect.any(String) }),
    );
  });

  it("moves free expired lots, skips reserved ones and recalculates stocks", async () => {
    const free = lot({ id: 1, product_id: 10, item_state_id: 1 });
    const reserved = lot({
      id: 2,
      number: "LOTE-2",
      product_id: 10,
      expiration_date: "2026-10-02",
      reserved: 2,
    });
    const other = lot({
      id: 3,
      number: "LOTE-3",
      product_id: 11,
      expiration_date: "2026-10-03",
      stock: 8,
    });
    const { repository } = setup({
      batches: [[free, reserved, other], []],
    });
    repository.moveToExpired.mockImplementation(
      async (candidate, itemStateId) => {
        candidate.item_state_id = itemStateId;
      },
    );

    const summary = await runExpireLotsJob({
      repository,
      batchSize: 500,
    });

    expect(summary).toEqual(
      expect.objectContaining({
        candidates: 3,
        moved: 2,
        skipped_reserved: [
          {
            lot_id: 2,
            number: "LOTE-2",
            expiration_date: "2026-10-02",
            reserved: 2,
          },
        ],
        affected_products: 2,
        stock_rows_updated: 4,
        expired_item_state_id: 3,
        locked: true,
        dry_run: false,
        errors: [],
      }),
    );
    expect(summary.started_at).toEqual(expect.any(String));
    expect(summary.finished_at).toEqual(expect.any(String));
    expect(summary.duration_ms).toEqual(expect.any(Number));
    expect(repository.moveToExpired).toHaveBeenCalledTimes(2);
    expect(repository.moveToExpired).toHaveBeenCalledWith(free, 3, TRANSACTION);
    expect(repository.moveToExpired).toHaveBeenCalledWith(
      other,
      3,
      TRANSACTION,
    );
    expect(repository.recalculateStock).toHaveBeenCalledTimes(4);
    expect(repository.recalculateStock).toHaveBeenCalledWith(
      10,
      1,
      TRANSACTION,
    );
    expect(repository.recalculateStock).toHaveBeenCalledWith(
      10,
      3,
      TRANSACTION,
    );
    expect(repository.recalculateStock).toHaveBeenCalledWith(
      11,
      1,
      TRANSACTION,
    );
    expect(repository.recalculateStock).toHaveBeenCalledWith(
      11,
      3,
      TRANSACTION,
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("finished"),
      expect.objectContaining({ moved: 2 }),
    );
  });

  it("returns an empty summary when there are no candidates", async () => {
    const { repository } = setup({ batches: [[]] });

    const summary = await runExpireLotsJob({ repository });

    expect(summary).toEqual(
      expect.objectContaining({
        candidates: 0,
        moved: 0,
        skipped_reserved: [],
        affected_products: 0,
        stock_rows_updated: 0,
        expired_item_state_id: 3,
        locked: true,
        dry_run: false,
        errors: [],
      }),
    );
    expect(repository.moveToExpired).not.toHaveBeenCalled();
    expect(repository.recalculateStock).not.toHaveBeenCalled();
  });

  it("plans moves without writing during a dry run", async () => {
    const free = lot();
    const { repository } = setup({ batches: [[free], []] });

    const summary = await runExpireLotsJob({
      repository,
      dryRun: true,
    });

    expect(summary).toEqual(
      expect.objectContaining({
        candidates: 1,
        moved: 1,
        stock_rows_updated: 0,
        affected_products: 1,
        expired_item_state_id: 3,
        locked: true,
        dry_run: true,
        errors: [],
      }),
    );
    expect(repository.moveToExpired).not.toHaveBeenCalled();
    expect(repository.recalculateStock).not.toHaveBeenCalled();
    expect(repository.transaction).toHaveBeenCalled();
  });

  it("reads every candidate batch with the FEFO keyset cursor", async () => {
    const first = lot({ id: 4, expiration_date: "2026-10-01" });
    const second = lot({ id: 5, expiration_date: "2026-10-05" });
    const { repository } = setup({
      batches: [[first], [second], []],
    });

    await runExpireLotsJob({ repository, batchSize: 1 });

    expect(repository.findCandidates).toHaveBeenCalledTimes(3);
    expect(repository.findCandidates.mock.calls[0][0]).toEqual(
      expect.objectContaining({ after: null, limit: 1 }),
    );
    expect(repository.findCandidates.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        after: { expirationDate: "2026-10-01", id: 4 },
        limit: 1,
      }),
    );
    expect(repository.findCandidates.mock.calls[2][0]).toEqual(
      expect.objectContaining({
        after: { expirationDate: "2026-10-05", id: 5 },
        limit: 1,
      }),
    );
  });

  it("propagates repository errors and logs them with the stack", async () => {
    const error = new Error("database down");
    const { repository } = setup({ batches: [[lot()], []] });
    repository.recalculateStock.mockRejectedValue(error);

    await expect(runExpireLotsJob({ repository })).rejects.toBe(error);
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ stack: error.stack }),
    );
  });

  it("uses the configured batch size when none is injected", async () => {
    const { repository } = setup({ batches: [[]] });
    const configured = process.env.LOTS_EXPIRY_JOB_BATCH_SIZE;
    process.env.LOTS_EXPIRY_JOB_BATCH_SIZE = "250";

    try {
      await runExpireLotsJob({ repository });

      expect(repository.findCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 250 }),
      );
    } finally {
      if (configured === undefined) {
        delete process.env.LOTS_EXPIRY_JOB_BATCH_SIZE;
      } else {
        process.env.LOTS_EXPIRY_JOB_BATCH_SIZE = configured;
      }
    }
  });
});
