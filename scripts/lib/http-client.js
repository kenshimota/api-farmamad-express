const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const DEFAULT_USER_AGENT =
  "FarmamadDemoBot/1.0 (+https://github.com/kenshimota/api-farmamad-express; demo fixture)";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * Builds a cache path for a URL. The hash keeps file names short and avoids
 * leaking query strings into the repository.
 * @param {string} directory - Cache directory.
 * @param {string} url - Requested URL.
 * @param {string} extension - Cache file extension.
 * @returns {string} Absolute cache path.
 */
function cachePath(directory, url, extension) {
  const hash = crypto.createHash("sha256").update(url).digest("hex");

  return path.join(directory, `${hash}.${extension}`);
}

/**
 * Creates a polite HTTP client with an identifiable User-Agent, a hard minimum
 * delay between requests, exponential retries for 429/5xx and an optional local
 * cache. It never retries 4xx responses, so a block stops the scraper.
 * @param {object} [options] - Client options.
 * @param {Function} [options.fetchImpl] - Fetch implementation.
 * @param {Function} [options.sleep] - Sleep function.
 * @param {Function} [options.now] - Clock function.
 * @param {number} [options.delay] - Minimum milliseconds between requests.
 * @param {number} [options.retries] - Retries for 429/5xx.
 * @param {string} [options.userAgent] - User-Agent header.
 * @param {string|null} [options.cacheDir] - Optional cache directory.
 * @returns {object} Client with fetchText and fetchBuffer.
 */
function createHttpClient({
  fetchImpl = global.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  delay = 1000,
  retries = 3,
  userAgent = DEFAULT_USER_AGENT,
  cacheDir = null,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required.");
  }

  let lastRequestAt = null;

  /**
   * Waits until one full delay has elapsed since the previous request.
   * @returns {Promise<void>} Resolves when the slot is available.
   */
  async function waitForSlot() {
    if (lastRequestAt === null) {
      return;
    }

    const elapsed = now() - lastRequestAt;
    if (elapsed < delay) {
      await sleep(delay - elapsed);
    }
  }

  /**
   * Reads a cached body when present.
   * @param {string} file - Cache path.
   * @returns {Promise<Buffer|null>} Cached bytes or null.
   */
  async function readCache(file) {
    if (!cacheDir) {
      return null;
    }

    try {
      return await fs.readFile(file);
    } catch (error) {
      return null;
    }
  }

  /**
   * Stores a body in the local cache, ignoring failures because the cache is
   * only an optimization.
   * @param {string} file - Cache path.
   * @param {Buffer} body - Bytes to store.
   * @returns {Promise<void>} Resolves after the write.
   */
  async function writeCache(file, body) {
    if (!cacheDir) {
      return;
    }

    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, body);
    } catch (error) {
      // Cache failures must not break a scrape.
    }
  }

  /**
   * Executes a request with retries and rate limiting.
   * @param {string} url - Requested URL.
   * @param {string} accept - Accept header.
   * @returns {Promise<Response>} Successful response.
   */
  async function request(url, accept) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      await waitForSlot();
      lastRequestAt = now();

      const response = await fetchImpl(url, {
        headers: { "User-Agent": userAgent, Accept: accept },
        redirect: "follow",
      });

      if (response.ok) {
        return response;
      }

      if (RETRYABLE.has(response.status) && attempt < retries) {
        const retryAfter = Number(response.headers?.get?.("retry-after"));
        const wait =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : delay * 2 ** (attempt + 1);

        await sleep(wait);
        continue;
      }

      throw new Error(
        `Request failed with ${response.status} for ${url}. The scraper stopped without trying to bypass the response.`,
      );
    }

    throw new Error(`Request failed after ${retries} retries for ${url}.`);
  }

  /**
   * Shared cache/request pipeline. The body reader is injected so text and
   * binary downloads can reuse the same caching and rate-limit rules.
   * @param {string} url - Requested URL.
   * @param {string} accept - Accept header.
   * @param {string} extension - Cache file extension.
   * @param {Function} readBody - Reads a Response into a Buffer.
   * @returns {Promise<Buffer>} Response bytes.
   */
  async function fetchCached(url, accept, extension, readBody) {
    const file = cachePath(cacheDir || ".", url, extension);
    const cached = await readCache(file);

    if (cached) {
      return cached;
    }

    const body = await readBody(await request(url, accept));
    await writeCache(file, body);

    return body;
  }

  return {
    /**
     * Downloads a text resource.
     * @param {string} url - Requested URL.
     * @returns {Promise<string>} Response body.
     */
    async fetchText(url) {
      const body = await fetchCached(
        url,
        "text/html,application/xml,text/plain,*/*",
        "txt",
        async (response) => Buffer.from(await response.text(), "utf8"),
      );

      return body.toString("utf8");
    },

    /**
     * Downloads a binary resource.
     * @param {string} url - Requested URL.
     * @returns {Promise<Buffer>} Response bytes.
     */
    fetchBuffer(url) {
      return fetchCached(url, "image/*,*/*", "bin", async (response) =>
        Buffer.from(await response.arrayBuffer()),
      );
    },
  };
}

module.exports = {
  DEFAULT_USER_AGENT,
  RETRYABLE,
  cachePath,
  createHttpClient,
};
