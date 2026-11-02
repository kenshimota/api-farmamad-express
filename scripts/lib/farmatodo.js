/**
 * Conversion rate documented by the scraper. Farmatodo publishes prices in
 * VES while the catalog stores costs in the default transaction currency
 * (USD_BCV, seeded by HU-22 with the same reference rate). The rate is a
 * deliberately fixed demo value: the fixture is not an official price source.
 */
const VES_PER_USD = 889.89;
const PRODUCT_PATH = "/producto/";

/**
 * Error raised when a Farmatodo page no longer has the expected structure.
 */
class ProductParseError extends Error {
  /**
   * @param {string} message - Actionable message.
   */
  constructor(message) {
    super(message);
    this.name = "ProductParseError";
  }
}

/**
 * Decodes the small set of HTML entities that appear in product pages.
 * @param {string} value - Raw text.
 * @returns {string} Decoded text.
 */
function decodeEntities(value = "") {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name) => named[name] ?? match);
}

/**
 * Collapses whitespace and decodes entities from a fragments of HTML.
 * @param {string} value - HTML fragment.
 * @returns {string} Plain text.
 */
function toText(value = "") {
  return decodeEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reads every JSON-LD object embedded in a page.
 * @param {string} html - Page HTML.
 * @returns {object[]} Parsed JSON-LD objects.
 */
function readJsonLd(html) {
  const documents = [];
  const pattern =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    try {
      const parsed = JSON.parse(match[1]);
      documents.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch (error) {
      // A malformed unrelated block must not hide the Product block.
    }
  }

  return documents;
}

/**
 * Resolves the first breadcrumb link, which is the main department/category.
 * @param {string} html - Page HTML.
 * @returns {string|null} Category name or null.
 */
function extractCategory(html) {
  const itemPattern =
    /<li[^>]*class="[^"]*breadcrumb__item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;

  for (const match of html.matchAll(itemPattern)) {
    const link = match[1].match(/<a[^>]*>([\s\S]*?)<\/a>/i);

    if (link) {
      const text = toText(link[1]);
      if (text) {
        return text;
      }
    }
  }

  return null;
}

/**
 * Extracts the public product data from a Farmatodo product page. It relies on
 * the Product JSON-LD block and the breadcrumb; when either is missing it fails
 * with an actionable error instead of silently returning partial data.
 * @param {string} html - Product page HTML.
 * @param {string} sourceUrl - Page URL.
 * @returns {object} Raw product data.
 * @throws {ProductParseError} When the page structure changed.
 */
function extractProduct(html, sourceUrl) {
  const document = readJsonLd(html).find(
    (item) => item && item["@type"] === "Product",
  );

  if (!document) {
    throw new ProductParseError(
      `No Product JSON-LD found at ${sourceUrl}. Farmatodo may have changed its page structure; the previous fixture was not modified.`,
    );
  }

  const offer = Array.isArray(document.offers)
    ? document.offers[0]
    : document.offers;
  const image = Array.isArray(document.image)
    ? document.image[0]
    : document.image;
  const productUrl = document.url || sourceUrl;
  const skuMatch = String(productUrl).match(/\/producto\/(\d+)/);
  const externalId = String(document.sku ?? skuMatch?.[1] ?? "").trim();
  const name = toText(document.name);
  const price = Number(String(offer?.price ?? "").replace(",", "."));
  const category = extractCategory(html);

  if (
    !externalId ||
    !name ||
    !image ||
    !Number.isFinite(price) ||
    price <= 0 ||
    Math.round((price / VES_PER_USD) * 100) <= 0 ||
    !category
  ) {
    throw new ProductParseError(
      `Incomplete product data at ${sourceUrl}: name, sku, image, price and category are required. The previous fixture was not modified.`,
    );
  }

  return {
    external_id: externalId,
    name: name.slice(0, 150),
    description: toText(document.description) || name,
    image_url: image,
    price,
    category: category.slice(0, 100),
    source_url: productUrl,
  };
}

/**
 * Converts raw scraped data to the versioned fixture contract. The cost is the
 * visible VES price converted to USD_BCV at the documented fixed rate and
 * rounded to two decimals.
 * @param {object} raw - Result of `extractProduct`.
 * @param {Date} fetchedAt - Scrape timestamp.
 * @returns {object} Fixture product.
 */
function toFixtureProduct(raw, fetchedAt) {
  const cost = Math.round((raw.price / VES_PER_USD) * 100) / 100;

  return {
    external_id: raw.external_id,
    name: raw.name,
    description: raw.description,
    reference: `FARMATODO-${raw.external_id}`.slice(0, 100),
    category: raw.category,
    tax_code: "IVA",
    cost,
    image: {
      original: `${raw.external_id}.webp`,
      thumbnail: `${raw.external_id}-thumb.webp`,
      reference: `demo-farmatodo-${raw.external_id}`,
    },
    source_url: raw.source_url,
    fetched_at: fetchedAt.toISOString(),
  };
}

/**
 * Extracts every `<loc>` from a sitemap or sitemap index.
 * @param {string} xml - Sitemap XML.
 * @returns {string[]} Locations in document order.
 */
function parseSitemap(xml = "") {
  const locations = [];

  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
    locations.push(decodeEntities(match[1]).trim());
  }

  return locations;
}

/**
 * Tells whether a URL points to a product page.
 * @param {string} url - Candidate URL.
 * @returns {boolean} True for product pages.
 */
function isProductUrl(url) {
  return new URL(url).pathname.startsWith(PRODUCT_PATH);
}

module.exports = {
  PRODUCT_PATH,
  ProductParseError,
  VES_PER_USD,
  extractCategory,
  extractProduct,
  isProductUrl,
  parseSitemap,
  readJsonLd,
  toFixtureProduct,
  toText,
};
