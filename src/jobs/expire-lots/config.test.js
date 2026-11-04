const { DEFAULT_CONFIG, loadConfig } = require("./config");

/**
 * Builds a logger double that records every call.
 * @returns {object} Logger double.
 */
function fakeLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe("expire lots job config", () => {
  it("uses the documented defaults when the variables are missing", () => {
    const logger = fakeLogger();

    expect(loadConfig({}, logger)).toEqual({
      enabled: true,
      hourUtc: 4,
      minuteUtc: 0,
      batchSize: 500,
    });
    expect(DEFAULT_CONFIG).toEqual({
      enabled: true,
      hourUtc: 4,
      minuteUtc: 0,
      batchSize: 500,
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("reads valid values from the environment", () => {
    const logger = fakeLogger();

    expect(
      loadConfig(
        {
          LOTS_EXPIRY_JOB_ENABLED: "true",
          LOTS_EXPIRY_JOB_HOUR_UTC: "23",
          LOTS_EXPIRY_JOB_MINUTE_UTC: "59",
          LOTS_EXPIRY_JOB_BATCH_SIZE: "5000",
        },
        logger,
      ),
    ).toEqual({
      enabled: true,
      hourUtc: 23,
      minuteUtc: 59,
      batchSize: 5000,
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("accepts the lower and upper bounds", () => {
    expect(
      loadConfig(
        {
          LOTS_EXPIRY_JOB_HOUR_UTC: "0",
          LOTS_EXPIRY_JOB_MINUTE_UTC: "0",
          LOTS_EXPIRY_JOB_BATCH_SIZE: "1",
        },
        fakeLogger(),
      ),
    ).toEqual({
      enabled: true,
      hourUtc: 0,
      minuteUtc: 0,
      batchSize: 1,
    });
  });

  it.each(["false", "FALSE", " False "])(
    "disables the scheduler when ENABLED is %p",
    (value) => {
      const logger = fakeLogger();

      expect(
        loadConfig({ LOTS_EXPIRY_JOB_ENABLED: value }, logger).enabled,
      ).toBe(false);
      expect(logger.warn).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["LOTS_EXPIRY_JOB_HOUR_UTC", "24", "hourUtc", 4],
    ["LOTS_EXPIRY_JOB_HOUR_UTC", "-1", "hourUtc", 4],
    ["LOTS_EXPIRY_JOB_HOUR_UTC", "abc", "hourUtc", 4],
    ["LOTS_EXPIRY_JOB_HOUR_UTC", "4.5", "hourUtc", 4],
    ["LOTS_EXPIRY_JOB_MINUTE_UTC", "60", "minuteUtc", 0],
    ["LOTS_EXPIRY_JOB_MINUTE_UTC", "-3", "minuteUtc", 0],
    ["LOTS_EXPIRY_JOB_BATCH_SIZE", "0", "batchSize", 500],
    ["LOTS_EXPIRY_JOB_BATCH_SIZE", "5001", "batchSize", 500],
    ["LOTS_EXPIRY_JOB_BATCH_SIZE", "many", "batchSize", 500],
  ])(
    "falls back and warns when %s is %p",
    (variable, value, field, fallback) => {
      const logger = fakeLogger();

      const config = loadConfig({ [variable]: value }, logger);

      expect(config[field]).toBe(fallback);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0][0]).toContain(variable);
      expect(logger.warn.mock.calls[0][1]).toEqual({ value });
    },
  );

  it("uses the default logger when none is injected", () => {
    const logger = require("../../config/logger");
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => {});

    expect(
      loadConfig({ LOTS_EXPIRY_JOB_BATCH_SIZE: "invalid" }).batchSize,
    ).toBe(500);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});
