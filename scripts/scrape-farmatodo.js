#!/usr/bin/env node
"use strict";

const path = require("path");
const { parseArgs } = require("./lib/args");
const { scrapeCatalog } = require("./lib/scrape");

const ASSETS_DIR = path.resolve("seeders", "assets", "demo", "products");
const CACHE_DIR = path.resolve("scripts", ".cache", "farmatodo");

/**
 * Runs the manual scraper. It uses the native fetch of Node 24, a one request
 * per second limiter, a local cache and a versioned fixture; it is never
 * executed by the test suite or by `npm run db:seed`.
 * @returns {Promise<void>} Resolves after the fixture is written.
 */
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { products } = await scrapeCatalog(
    { ...options, assetsDir: ASSETS_DIR },
    { cacheDir: CACHE_DIR },
  );

  console.log(
    `Farmatodo fixture written to ${path.relative(process.cwd(), options.out)} with ${products.length} products and images in ${path.relative(process.cwd(), ASSETS_DIR)}.`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Scrape failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { ASSETS_DIR, CACHE_DIR, main };
