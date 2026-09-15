const {
  detectOperation,
  formatQuery,
  logQuery,
  isQueryLoggingEnabled,
} = require("./sql");

const ANSI_PATTERN = /\u001b\[\d+m/;

describe("detectOperation", () => {
  it("detects a SELECT statement", () => {
    expect(detectOperation('SELECT * FROM "users"')).toBe("SELECT");
  });

  it("detects an INSERT statement", () => {
    expect(detectOperation('INSERT INTO "users" ("name") VALUES ($1)')).toBe(
      "INSERT",
    );
  });

  it("detects an UPDATE statement", () => {
    expect(detectOperation('UPDATE "users" SET "name" = $1')).toBe("UPDATE");
  });

  it("detects a DELETE statement", () => {
    expect(detectOperation('DELETE FROM "users" WHERE "id" = $1')).toBe(
      "DELETE",
    );
  });

  it("ignores the Sequelize Executed/Executing prefix", () => {
    expect(detectOperation("Executed (default): SELECT 1")).toBe("SELECT");
    expect(detectOperation("Executing (abc-123): DELETE FROM t")).toBe(
      "DELETE",
    );
  });

  it("is case insensitive and tolerates leading whitespace", () => {
    expect(detectOperation("\n  select 1")).toBe("SELECT");
  });

  it("falls back to SQL for unknown statements", () => {
    expect(detectOperation("BEGIN")).toBe("SQL");
    expect(detectOperation("")).toBe("SQL");
  });
});

describe("isQueryLoggingEnabled", () => {
  const original = process.env.NODE_ENV;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = original;
    }
  });

  it("is enabled only in development", () => {
    process.env.NODE_ENV = "development";
    expect(isQueryLoggingEnabled()).toBe(true);

    process.env.NODE_ENV = "production";
    expect(isQueryLoggingEnabled()).toBe(false);

    process.env.NODE_ENV = "test";
    expect(isQueryLoggingEnabled()).toBe(false);
  });
});

describe("formatQuery", () => {
  let originalIsTTY;

  /**
   * Overrides `process.stdout.isTTY` so colour behaviour can be tested.
   * @param {boolean|undefined} value
   */
  function setTTY(value) {
    Object.defineProperty(process.stdout, "isTTY", {
      value,
      configurable: true,
    });
  }

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
    delete process.env.NO_COLOR;
  });

  afterEach(() => {
    setTTY(originalIsTTY);
  });

  it("colors SELECT statements in blue", () => {
    setTTY(true);
    expect(formatQuery("SELECT 1")).toContain("\u001b[34m");
  });

  it("colors UPDATE statements in yellow", () => {
    setTTY(true);
    expect(formatQuery("UPDATE t SET a = 1")).toContain("\u001b[33m");
  });

  it("colors INSERT statements in green", () => {
    setTTY(true);
    expect(formatQuery("INSERT INTO t VALUES (1)")).toContain("\u001b[32m");
  });

  it("colors DELETE statements in red", () => {
    setTTY(true);
    expect(formatQuery("DELETE FROM t")).toContain("\u001b[31m");
  });

  it("uses a neutral color for unknown statements", () => {
    setTTY(true);
    expect(formatQuery("BEGIN")).toContain("\u001b[90m");
  });

  it("prints the operation label and the statement", () => {
    const line = formatQuery('SELECT * FROM "users"');
    expect(line).toContain("SELECT");
    expect(line).toContain('SELECT * FROM "users"');
    expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
  });

  it("strips the Sequelize prefix from the printed statement", () => {
    const line = formatQuery("Executed (default): SELECT 1");
    expect(line).not.toContain("Executed");
    expect(line).toContain("SELECT 1");
  });

  it("appends the execution time when available", () => {
    expect(formatQuery("SELECT 1", 12)).toContain("(12 ms)");
  });

  it("omits the execution time when it is not a number", () => {
    expect(formatQuery("SELECT 1")).not.toContain("ms)");
    expect(formatQuery("SELECT 1", { logging: true })).not.toContain("ms)");
  });

  it("keeps ANSI colors even when stdout is not a TTY", () => {
    setTTY(false);
    expect(formatQuery("SELECT 1", 3)).toMatch(ANSI_PATTERN);
  });

  it("keeps ANSI colors even when NO_COLOR is defined", () => {
    setTTY(true);
    process.env.NO_COLOR = "";
    expect(formatQuery("SELECT 1")).toMatch(ANSI_PATTERN);
  });
});

describe("logQuery", () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("writes the formatted query to console.log", () => {
    logQuery("SELECT 1", 5);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain("SELECT 1");
    expect(logSpy.mock.calls[0][0]).toContain("(5 ms)");
  });
});
