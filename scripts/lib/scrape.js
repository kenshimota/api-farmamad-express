const fs = require("fs/promises");
const path = require("path");
const { assertAllowed, parseRobots } = require("./robots");
const { createHttpClient, DEFAULT_USER_AGENT } = require("./http-client");
const {
  VES_PER_USD,
  extractProduct,
  isProductUrl,
  parseSitemap,
  toFixtureProduct,
} = require("./farmatodo");
const {
  collectValidProducts,
  writeFixtureAtomic,
} = require("./fixture-writer");
const { processProductImage } = require("./image-assets");

/**
 * Removes assets that are no longer referenced by the fixture, so a rerun does
 * not leave stale images from discarded products in the repository.
 * @param {string} assetsDir - Assets folder.
 * @param {object[]} products - Kept fixture products.
 * @returns {Promise<void>}
 */
async function pruneAssets(assetsDir, products) {
  const expected = new Set(
    products.flatMap((product) => [
      product.image.original,
      product.image.thumbnail,
    ]),
  );

  for (const file of await fs.readdir(assetsDir)) {
    if (!expected.has(file)) {
      await fs.unlink(path.join(assetsDir, file)).catch(() => undefined);
    }
  }
}

const BASE_URL = "https://www.farmatodo.com.ve";
const ROBOTS_URL = `${BASE_URL}/robots.txt`;
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;

/**
 * Walks the sitemap tree (Farmatodo nests an index inside another index) until
 * it reaches product URLs.
 * @param {object} client - HTTP client.
 * @param {object[]} robots - Parsed robots.txt groups.
 * @param {string} userAgent - User-Agent header.
 * @param {string} sitemap - Sitemap URL.
 * @param {Set<string>} visited - Already visited sitemaps.
 * @param {string[]} products - Accumulated product URLs.
 * @param {number} [depth] - Current recursion depth.
 * @returns {Promise<void>}
 */
async function walkSitemap(
  client,
  robots,
  userAgent,
  sitemap,
  visited,
  products,
  depth = 0,
) {
  if (visited.has(sitemap) || depth > 3) {
    return;
  }

  visited.add(sitemap);
  assertAllowed(robots, new URL(sitemap).pathname, userAgent);

  const locations = parseSitemap(await client.fetchText(sitemap));
  const nested = locations.filter((url) => /\.xml(?:\?|$)/i.test(url));
  products.push(...locations.filter((url) => isProductUrl(url)));

  for (const child of nested) {
    await walkSitemap(
      client,
      robots,
      userAgent,
      child,
      visited,
      products,
      depth + 1,
    );
  }
}

/**
 * Builds a stable Product JSON-LD page URL list from the site sitemap tree.
 * @param {object} client - HTTP client.
 * @param {object[]} robots - Parsed robots.txt groups.
 * @param {string} userAgent - User-Agent header.
 * @returns {Promise<string[]>} Product page URLs.
 */
async function productUrls(client, robots, userAgent) {
  const urls = [];
  await walkSitemap(client, robots, userAgent, SITEMAP_URL, new Set(), urls);

  if (urls.length === 0) {
    throw new Error(
      "Farmatodo sitemap has no product URLs. The site structure changed; the previous fixture was not modified.",
    );
  }

  return urls;
}

/**
 * Downloads and processes the image of one product. Products whose image is
 * not a real image are discarded instead of using a placeholder.
 * @param {object} client - HTTP client.
 * @param {string} imageUrl - Remote image URL.
 * @param {object} product - Fixture product.
 * @param {string} assetsDir - Destination folder.
 * @returns {Promise<boolean>} True when the assets were generated.
 */
async function downloadAssets(client, imageUrl, product, assetsDir) {
  try {
    const buffer = await client.fetchBuffer(imageUrl);

    await processProductImage(buffer, {
      originalPath: path.join(assetsDir, product.image.original),
      thumbnailPath: path.join(assetsDir, product.image.thumbnail),
    });

    return true;
  } catch (error) {
    console.warn(
      `Skipping product ${product.external_id}: image ${imageUrl} is not valid (${error.message}).`,
    );
    return false;
  }
}

/**
 * Visits product pages until the limit is reached, skipping duplicate ids and
 * pages whose image is not a real image. Each page is checked against
 * robots.txt before it is downloaded.
 * @param {object} client - HTTP client.
 * @param {object[]} robots - Parsed robots.txt groups.
 * @param {string} userAgent - User-Agent header.
 * @param {{ limit: number, assetsDir: string, now: Function }} settings - Limits.
 * @returns {Promise<object[]>} Candidate fixture products.
 */
async function collectCandidates(
  client,
  robots,
  userAgent,
  { limit, assetsDir, now },
) {
  const candidates = [];
  const seen = new Set();

  for (const url of await productUrls(client, robots, userAgent)) {
    if (candidates.length >= limit) {
      break;
    }

    assertAllowed(robots, new URL(url).pathname, userAgent);

    let raw;
    try {
      raw = extractProduct(await client.fetchText(url), url);
    } catch (error) {
      console.warn(`Skipping ${url}: ${error.message}`);
      continue;
    }

    if (seen.has(raw.external_id)) {
      continue;
    }

    const product = toFixtureProduct(raw, now());
    if (!(await downloadAssets(client, raw.image_url, product, assetsDir))) {
      continue;
    }

    seen.add(raw.external_id);
    candidates.push(product);
  }

  return candidates;
}

/**
 * Builds the versioned fixture payload around the validated products.
 * @param {object[]} products - Valid fixture products.
 * @param {Date} generatedAt - Scrape timestamp.
 * @returns {object} Fixture payload.
 */
function buildFixture(products, generatedAt) {
  return {
    source: BASE_URL,
    generated_at: generatedAt.toISOString(),
    license_note:
      "Datos públicos de Farmatodo usados exclusivamente para la demo de Farmamad. No es una fuente oficial de precios.",
    currency_conversion: {
      from: "VES",
      to: "USD_BCV",
      ves_per_usd: VES_PER_USD,
    },
    products,
  };
}

/**
 * Scrapes public Farmatodo product pages and writes the versioned fixture plus
 * WebP assets. It checks robots.txt before every page, discards incomplete
 * products, requires a minimum number of valid rows and writes the fixture
 * atomically so a failed run never replaces the previous one.
 * @param {object} options - Scrape options.
 * @param {number} options.limit - Maximum products to collect.
 * @param {number} [options.minimum] - Minimum valid products.
 * @param {string} options.out - Fixture destination.
 * @param {string} options.assetsDir - Image destination folder.
 * @param {number} [options.delay] - Milliseconds between requests.
 * @param {object} [deps] - Injectable dependencies for tests.
 * @returns {Promise<object>} Fixture result.
 */
async function scrapeCatalog(options, deps = {}) {
  const { limit = 120, minimum = 100, out, assetsDir, delay = 1000 } = options;
  const now = deps.now || (() => new Date());
  const userAgent = deps.userAgent || DEFAULT_USER_AGENT;
  const client = createHttpClient({
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
    delay,
    userAgent,
    cacheDir: deps.cacheDir ?? null,
    now: deps.now ? () => deps.now().getTime() : undefined,
  });

  const robots = parseRobots(await client.fetchText(ROBOTS_URL));
  assertAllowed(robots, new URL(SITEMAP_URL).pathname, userAgent);

  await fs.mkdir(assetsDir, { recursive: true });

  const candidates = await collectCandidates(client, robots, userAgent, {
    limit,
    assetsDir,
    now,
  });
  const products = collectValidProducts(candidates, { minimum, limit });
  const fixture = buildFixture(products, now());

  await writeFixtureAtomic(out, fixture);
  await pruneAssets(assetsDir, products);

  return { fixture, products };
}

module.exports = { BASE_URL, ROBOTS_URL, SITEMAP_URL, scrapeCatalog };
