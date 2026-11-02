const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const { scrapeCatalog } = require("./scrape");

const ROBOTS = "User-Agent: *\nDisallow: /buscar*\nAllow: /producto/\n";

function html(externalId) {
  return `<html><body>
    <nav class="product-detail__breadcrumb"><ol class="breadcrumb">
      <li class="breadcrumb__item"><a class="breadcrumb__link">Medicamentos</a></li>
    </ol></nav>
    <script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      name: `Producto ${externalId}`,
      image: `https://cdn.example.com/${externalId}.png`,
      description: "Descripción pública",
      sku: externalId,
      url: `https://www.farmatodo.com.ve/producto/${externalId}-producto`,
      offers: { priceCurrency: "VES", price: 1779.78 },
    })}</script>
  </body></html>`;
}

async function imageBuffer() {
  return sharp({
    create: {
      width: 500,
      height: 500,
      channels: 3,
      background: { r: 20, g: 30, b: 40 },
    },
  })
    .png()
    .toBuffer();
}

describe("scrapeCatalog", () => {
  let directory;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "scrape-demo-"));
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  function deps() {
    return {
      sleep: jest.fn(async () => {}),
      now: () => new Date("2026-11-02T12:00:00Z"),
      fetchImpl: jest.fn(async (url) => {
        if (url.endsWith("/robots.txt")) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            text: async () => ROBOTS,
          };
        }

        if (url.endsWith("sitemap.xml")) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            text: async () =>
              "<sitemapindex><sitemap><loc>https://www.farmatodo.com.ve/sitemap-products-001.xml</loc></sitemap></sitemapindex>",
          };
        }

        if (url.endsWith("sitemap-products-001.xml")) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            text: async () =>
              ["101", "102", "103"]
                .map(
                  (id) =>
                    `<url><loc>https://www.farmatodo.com.ve/producto/${id}-producto</loc></url>`,
                )
                .join(""),
          };
        }

        if (url.includes("/producto/")) {
          const id = url.match(/producto\/(\d+)/)[1];

          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            text: async () => html(id),
          };
        }

        if (url.includes("cdn.example.com")) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            arrayBuffer: async () => {
              const buffer = await imageBuffer();

              return buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength,
              );
            },
          };
        }

        throw new Error(`Unexpected URL ${url}`);
      }),
    };
  }

  it("writes a fixture and image assets after a successful scrape", async () => {
    const out = path.join(directory, "demo-products.json");
    const assetsDir = path.join(directory, "assets");

    const result = await scrapeCatalog(
      { limit: 2, minimum: 2, out, assetsDir, delay: 1000 },
      deps(),
    );

    const fixture = JSON.parse(await fs.readFile(out, "utf8"));
    const files = await fs.readdir(assetsDir);

    expect(result.products).toHaveLength(2);
    expect(fixture.products.map((item) => item.external_id)).toEqual([
      "101",
      "102",
    ]);
    expect(files.sort()).toEqual([
      "101-thumb.webp",
      "101.webp",
      "102-thumb.webp",
      "102.webp",
    ]);
  });

  it("does not replace the previous fixture when robots blocks the scrape", async () => {
    const out = path.join(directory, "demo-products.json");
    await fs.writeFile(out, '{"products":[]}\n', "utf8");
    const fake = deps();
    const fetchImpl = fake.fetchImpl;
    fake.fetchImpl = jest.fn(async (url) => {
      if (url.endsWith("/robots.txt")) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => "User-Agent: *\nDisallow: /\n",
        };
      }

      return fetchImpl(url);
    });

    await expect(
      scrapeCatalog(
        { limit: 2, minimum: 2, out, assetsDir: directory, delay: 1000 },
        fake,
      ),
    ).rejects.toThrow(/robots\.txt/);

    expect(await fs.readFile(out, "utf8")).toBe('{"products":[]}\n');
  });

  it("does not write the fixture when there are not enough products", async () => {
    const out = path.join(directory, "demo-products.json");

    await expect(
      scrapeCatalog(
        {
          limit: 2,
          minimum: 3,
          out,
          assetsDir: path.join(directory, "assets"),
          delay: 1000,
        },
        deps(),
      ),
    ).rejects.toThrow(/fewer than 3 valid products/);

    await expect(fs.stat(out)).rejects.toThrow();
  });
});
