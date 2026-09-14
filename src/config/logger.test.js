const logger = require("./logger");

const ANSI_PATTERN = /\u001b\[\d+m/;

describe("logger", () => {
  let logSpy;
  let warnSpy;
  let errorSpy;
  let originalIsTTY;

  /**
   * Overrides `process.stdout.isTTY` so color behaviour can be tested.
   * @param {boolean|undefined} value
   */
  function setTTY(value) {
    Object.defineProperty(process.stdout, "isTTY", {
      value,
      configurable: true,
    });
  }

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    originalIsTTY = process.stdout.isTTY;
    delete process.env.NO_COLOR;
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    setTTY(originalIsTTY);
    jest.restoreAllMocks();
  });

  it("writes info logs with ISO timestamp, level, message and context", () => {
    logger.info("request completed", { method: "GET", status: 200 });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0][0];
    expect(line).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z INFO request completed/,
    );
    expect(line).toContain("method=GET");
    expect(line).toContain("status=200");
  });

  it("writes warn logs with the WARN label", () => {
    logger.warn("slow request");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("WARN");
    expect(warnSpy.mock.calls[0][0]).toContain("slow request");
  });

  it("writes error logs with the ERROR label and the stack trace", () => {
    const error = new Error("boom");

    logger.error("unhandled error", { stack: error.stack, method: "POST" });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = errorSpy.mock.calls[0][0];
    expect(line).toContain("ERROR");
    expect(line).toContain("unhandled error");
    expect(line).toContain("Error: boom");
    expect(line).toContain("method=POST");
  });

  it("renders the stack trace on its own indented lines after the message", () => {
    const error = new Error("kaboom");

    logger.error("failure", { stack: error.stack, method: "GET" });

    const line = errorSpy.mock.calls[0][0];
    expect(line).toMatch(/failure\n {4}Error: kaboom/);
    expect(line).toMatch(/\n\s+at /);
    expect(line).toContain("method=GET");
  });

  it("prints a bare line without trailing whitespace when there is no context", () => {
    logger.info("plain message");

    const line = logSpy.mock.calls[0][0];
    expect(line).not.toMatch(/\s$/);
    expect(line).not.toContain("undefined");
  });

  it("respects LOG_LEVEL=warn by suppressing info", () => {
    process.env.LOG_LEVEL = "warn";

    logger.info("hidden");
    logger.warn("visible");

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("respects LOG_LEVEL=error by suppressing info and warn", () => {
    process.env.LOG_LEVEL = "error";

    logger.info("hidden");
    logger.warn("hidden");
    logger.error("visible");

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to info level when LOG_LEVEL is unknown", () => {
    process.env.LOG_LEVEL = "verbose";

    logger.info("visible");

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("disables ANSI colors when stdout is not a TTY", () => {
    setTTY(false);

    logger.info("plain");

    expect(logSpy.mock.calls[0][0]).not.toMatch(ANSI_PATTERN);
  });

  it("adds ANSI colors when stdout is a TTY", () => {
    setTTY(true);

    logger.info("colored");
    logger.warn("colored");
    logger.error("colored");

    expect(logSpy.mock.calls[0][0]).toMatch(ANSI_PATTERN);
    expect(warnSpy.mock.calls[0][0]).toMatch(ANSI_PATTERN);
    expect(errorSpy.mock.calls[0][0]).toMatch(ANSI_PATTERN);
  });

  it("highlights each level with its own color and resets it", () => {
    setTTY(true);

    logger.info("colored");
    logger.warn("colored");
    logger.error("colored");

    expect(logSpy.mock.calls[0][0]).toContain("\u001b[32mINFO\u001b[0m");
    expect(warnSpy.mock.calls[0][0]).toContain("\u001b[33mWARN\u001b[0m");
    expect(errorSpy.mock.calls[0][0]).toContain("\u001b[31mERROR\u001b[0m");
  });

  it("disables ANSI colors when NO_COLOR is defined even on a TTY", () => {
    setTTY(true);
    process.env.NO_COLOR = "";

    logger.info("plain");

    expect(logSpy.mock.calls[0][0]).not.toMatch(ANSI_PATTERN);
  });

  it("redacts sensitive context values", () => {
    logger.info("auth", {
      password: "secreto123",
      token: "jwt-token",
      Authorization: "Bearer abc",
      code: "12345678",
      userId: 7,
    });

    const line = logSpy.mock.calls[0][0];
    expect(line).not.toContain("secreto123");
    expect(line).not.toContain("jwt-token");
    expect(line).not.toContain("Bearer abc");
    expect(line).not.toContain("12345678");
    expect(line).toContain("password=[REDACTED]");
    expect(line).toContain("userId=7");
  });

  it("omits undefined and null context values", () => {
    logger.info("no context", { requestId: undefined, status: null });

    const line = logSpy.mock.calls[0][0];
    expect(line).not.toContain("requestId");
    expect(line).not.toContain("status");
  });

  it("omits empty string context values", () => {
    logger.info("no context", { requestId: "" });

    expect(logSpy.mock.calls[0][0]).not.toContain("requestId");
  });

  it("separates context pairs with a single space", () => {
    logger.info("request", { method: "GET", status: 200 });

    expect(logSpy.mock.calls[0][0]).toContain("method=GET status=200");
  });

  it("prints error objects as their message", () => {
    logger.info("failure", { cause: new Error("disk full") });

    expect(logSpy.mock.calls[0][0]).toContain("cause=disk full");
  });

  it("prints an error stack without any inline context", () => {
    const error = new Error("only stack");

    logger.error("failure", { stack: error.stack });

    const line = errorSpy.mock.calls[0][0];
    expect(line).toContain("Error: only stack");
    expect(line).not.toMatch(/\n {4}$/);
  });

  it("redacts every sensitive key it knows about", () => {
    const sensitive = {
      passwordconfirmation: "s1",
      password_confirmation: "s2",
      accesstoken: "s3",
      refreshtoken: "s4",
      cookie: "s5",
      secret: "s6",
      jwt: "s7",
      codehash: "s8",
      recoverycode: "s9",
    };

    logger.info("auth", sensitive);

    const line = logSpy.mock.calls[0][0];
    for (const value of Object.values(sensitive)) {
      expect(line).not.toContain(value);
    }
    expect(line.match(/\[REDACTED\]/g)).toHaveLength(
      Object.keys(sensitive).length,
    );
  });

  it("sanitizes nested objects and arrays", () => {
    logger.info("nested", {
      items: [{ token: "abc" }, "plain"],
      meta: { password: "x", userId: 3 },
    });

    const line = logSpy.mock.calls[0][0];
    expect(line).toContain("items=[");
    expect(line).toContain("plain");
    expect(line).toContain("meta=");
    expect(line).not.toContain("abc");
    expect(line).not.toContain('"password":"x"');
    expect(line).toContain("userId");
  });
});
