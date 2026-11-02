const path = require("path");
const { parseArgs, DEFAULT_LIMIT, MIN_LIMIT } = require("./args");

describe("scrape arguments", () => {
  it("uses the documented defaults", () => {
    const options = parseArgs([]);

    expect(options.limit).toBe(DEFAULT_LIMIT);
    expect(DEFAULT_LIMIT).toBe(120);
    expect(MIN_LIMIT).toBe(100);
    expect(options.delay).toBe(1000);
    expect(options.out).toBe(
      path.resolve("seeders", "data", "demo-products.json"),
    );
  });

  it("accepts --limit, --out and --delay", () => {
    const options = parseArgs([
      "--limit=100",
      "--out=/tmp/demo.json",
      "--delay=2500",
    ]);

    expect(options).toEqual(
      expect.objectContaining({
        limit: 100,
        out: "/tmp/demo.json",
        delay: 2500,
      }),
    );
  });

  it("resolves relative output paths against the working directory", () => {
    expect(parseArgs(["--out=tmp/demo.json"]).out).toBe(
      path.resolve("tmp", "demo.json"),
    );
  });

  it.each([
    ["--limit=99", /at least 100/],
    ["--limit=abc", /limit must be an integer/],
    ["--delay=999", /at least 1000/],
    ["--unknown=1", /Unknown option/],
    ["--out", /--out requires a value/],
  ])("rejects invalid arguments %s", (arg, message) => {
    expect(() => parseArgs([arg])).toThrow(message);
  });
});
