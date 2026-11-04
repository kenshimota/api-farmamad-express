jest.mock("./service", () => ({
  runExpireLotsJob: jest.fn(),
}));

const { runExpireLotsJob } = require("./service");
const { createExpireLotsScheduler } = require("./scheduler");

const CONFIG = Object.freeze({
  enabled: true,
  hourUtc: 4,
  minuteUtc: 0,
  batchSize: 500,
});

/**
 * Builds a logger double.
 * @returns {object} Logger double.
 */
function fakeLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Builds timer doubles.
 * @returns {object} Timer doubles.
 */
function fakeTimers() {
  const timer = { unref: jest.fn() };
  return {
    timer,
    setTimeout: jest.fn(() => timer),
    clearTimeout: jest.fn(),
  };
}

describe("expire lots scheduler", () => {
  beforeEach(() => {
    runExpireLotsJob.mockReset();
    runExpireLotsJob.mockResolvedValue({ moved: 0 });
  });

  it("does not schedule when the job is disabled", () => {
    const logger = fakeLogger();
    const timers = fakeTimers();
    const scheduler = createExpireLotsScheduler({
      logger,
      config: { ...CONFIG, enabled: false },
      env: { NODE_ENV: "production" },
      now: () => new Date("2026-11-03T03:00:00.000Z"),
      timers,
    });

    expect(scheduler.start()).toBeNull();
    expect(timers.setTimeout).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("disabled"),
      expect.any(Object),
    );
  });

  it("does not schedule in the test environment", () => {
    const timers = fakeTimers();
    const scheduler = createExpireLotsScheduler({
      logger: fakeLogger(),
      config: CONFIG,
      env: { NODE_ENV: "test" },
      now: () => new Date("2026-11-03T03:00:00.000Z"),
      timers,
    });

    expect(scheduler.start()).toBeNull();
    expect(timers.setTimeout).not.toHaveBeenCalled();
  });

  it("schedules the next UTC occurrence and unrefs the timer", () => {
    const timers = fakeTimers();
    const scheduler = createExpireLotsScheduler({
      logger: fakeLogger(),
      config: CONFIG,
      env: { NODE_ENV: "production" },
      now: () => new Date("2026-11-03T03:00:00.000Z"),
      timers,
    });

    expect(scheduler.start()).toBe(timers.timer);
    expect(timers.setTimeout).toHaveBeenCalledWith(
      expect.any(Function),
      60 * 60 * 1000,
    );
    expect(timers.timer.unref).toHaveBeenCalled();
  });

  it("schedules the next day when the time already passed", () => {
    const timers = fakeTimers();
    const scheduler = createExpireLotsScheduler({
      logger: fakeLogger(),
      config: CONFIG,
      env: { NODE_ENV: "production" },
      now: () => new Date("2026-11-03T05:00:00.000Z"),
      timers,
    });

    scheduler.start();

    expect(timers.setTimeout).toHaveBeenCalledWith(
      expect.any(Function),
      23 * 60 * 60 * 1000,
    );
  });

  it("runs the job when the timer fires and schedules the next run", async () => {
    const timers = fakeTimers();
    const scheduler = createExpireLotsScheduler({
      logger: fakeLogger(),
      config: CONFIG,
      env: { NODE_ENV: "production" },
      now: () => new Date("2026-11-03T03:00:00.000Z"),
      timers,
    });
    scheduler.start();
    const fire = timers.setTimeout.mock.calls[0][0];

    await fire();

    expect(runExpireLotsJob).toHaveBeenCalledTimes(1);
    expect(timers.setTimeout).toHaveBeenCalledTimes(2);
  });

  it("logs a failed run with its stack and keeps scheduling", async () => {
    const error = new Error("boom");
    runExpireLotsJob.mockRejectedValue(error);
    const logger = fakeLogger();
    const timers = fakeTimers();
    const scheduler = createExpireLotsScheduler({
      logger,
      config: CONFIG,
      env: { NODE_ENV: "production" },
      now: () => new Date("2026-11-03T03:00:00.000Z"),
      timers,
    });

    await expect(scheduler.execute()).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ stack: error.stack }),
    );
    expect(timers.setTimeout).toHaveBeenCalledTimes(1);
  });

  it("skips an overlapping run with a warning", async () => {
    let release;
    runExpireLotsJob.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const logger = fakeLogger();
    const timers = fakeTimers();
    const scheduler = createExpireLotsScheduler({
      logger,
      config: CONFIG,
      env: { NODE_ENV: "production" },
      now: () => new Date("2026-11-03T03:00:00.000Z"),
      timers,
    });

    const first = scheduler.execute();
    const second = await scheduler.execute();

    expect(second).toBeNull();
    expect(runExpireLotsJob).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("still running"),
      expect.any(Object),
    );

    release({ moved: 1 });
    await first;
  });

  it("clears the pending timer when stopped", () => {
    const timers = fakeTimers();
    const scheduler = createExpireLotsScheduler({
      logger: fakeLogger(),
      config: CONFIG,
      env: { NODE_ENV: "production" },
      now: () => new Date("2026-11-03T03:00:00.000Z"),
      timers,
    });
    scheduler.start();

    scheduler.stop();

    expect(timers.clearTimeout).toHaveBeenCalledWith(timers.timer);
  });
});
