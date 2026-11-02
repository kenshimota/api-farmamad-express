const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createHttpClient } = require("./http-client");

function response(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => String(body),
    arrayBuffer: async () => Buffer.from(body).buffer,
  };
}

describe("polite HTTP client", () => {
  it("sends an identifiable user agent and returns text", async () => {
    const fetchImpl = jest.fn(async () => response(200, "ok"));
    const client = createHttpClient({
      fetchImpl,
      sleep: jest.fn(),
      userAgent: "FarmamadDemoBot/1.0",
    });

    await expect(client.fetchText("https://example.com/a")).resolves.toBe("ok");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.com/a",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": "FarmamadDemoBot/1.0",
        }),
      }),
    );
  });

  it("retries 5xx responses with exponential waits", async () => {
    const sleep = jest.fn(async () => {});
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response(503, "busy"))
      .mockResolvedValueOnce(response(200, "ok"));
    const client = createHttpClient({ fetchImpl, sleep, delay: 1000 });

    await expect(client.fetchText("https://example.com/a")).resolves.toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("does not retry a forbidden response", async () => {
    const fetchImpl = jest.fn(async () => response(403, "blocked"));
    const client = createHttpClient({ fetchImpl, sleep: jest.fn() });

    await expect(client.fetchText("https://example.com/a")).rejects.toThrow(
      /403/,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("waits between requests to keep at most one per delay", async () => {
    const sleep = jest.fn(async () => {});
    let clock = 0;
    const client = createHttpClient({
      fetchImpl: jest.fn(async () => {
        clock += 100;
        return response(200, "ok");
      }),
      sleep: async (ms) => {
        clock += ms;
        await sleep(ms);
      },
      now: () => clock,
      delay: 1000,
    });

    await client.fetchText("https://example.com/a");
    await client.fetchText("https://example.com/b");

    expect(sleep).toHaveBeenCalledWith(900);
  });

  it("caches responses to avoid repeating downloads", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "http-cache-"));
    const fetchImpl = jest.fn(async () => response(200, "cached"));
    const client = createHttpClient({
      fetchImpl,
      sleep: jest.fn(),
      cacheDir: directory,
    });

    try {
      await expect(client.fetchText("https://example.com/a")).resolves.toBe(
        "cached",
      );
      await expect(client.fetchText("https://example.com/a")).resolves.toBe(
        "cached",
      );
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
