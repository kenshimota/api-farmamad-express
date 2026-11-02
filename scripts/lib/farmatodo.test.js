const {
  VES_PER_USD,
  extractProduct,
  parseSitemap,
  toFixtureProduct,
} = require("./farmatodo");

const PRODUCT_URL =
  "https://www.farmatodo.com.ve/producto/111934531-cereal-infantil";

function productHtml(overrides = {}) {
  const json = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: "  Cereal Infantil Cerelac 400 g  ",
    image: "https://cdn.example.com/cerelac.jpg",
    description: "  Alimento   vitaminado con trigo.  ",
    sku: 111934531,
    url: PRODUCT_URL,
    offers: { "@type": "Offer", priceCurrency: "VES", price: 889.89 },
    ...overrides,
  };

  return `
  <html><body>
    <nav class="product-detail__breadcrumb"><ol class="breadcrumb">
      <li class="breadcrumb__item"><a class="breadcrumb__link" href="/categorias/alimentos-y-bebidas">
        Alimentos y Bebidas
      </a></li>
      <li class="breadcrumb__item"><a class="breadcrumb__link" href="/categorias/alimentos-y-bebidas/alimentos">
        Alimentos
      </a></li>
    </ol></nav>
    <script id="dynamic-jsonld" type="application/ld+json">${JSON.stringify(json)}</script>
  </body></html>`;
}

describe("Farmatodo parsing", () => {
  it("extracts product data and the main breadcrumb category", () => {
    const product = extractProduct(productHtml(), PRODUCT_URL);

    expect(product).toEqual({
      external_id: "111934531",
      name: "Cereal Infantil Cerelac 400 g",
      description: "Alimento vitaminado con trigo.",
      image_url: "https://cdn.example.com/cerelac.jpg",
      price: 889.89,
      category: "Alimentos y Bebidas",
      source_url: PRODUCT_URL,
    });
  });

  it("supports offers declared as an array", () => {
    const html = productHtml({
      offers: [{ "@type": "Offer", priceCurrency: "VES", price: 1779.78 }],
    });

    expect(extractProduct(html, PRODUCT_URL).price).toBe(1779.78);
  });

  it("rejects pages without a Product JSON-LD block", () => {
    expect(() => extractProduct("<html></html>", PRODUCT_URL)).toThrow(
      /JSON-LD/,
    );
  });

  it("rejects products with a zero price", () => {
    const html = productHtml({
      offers: { "@type": "Offer", priceCurrency: "VES", price: 1 },
    });

    expect(() => extractProduct(html, PRODUCT_URL)).toThrow(/Incomplete/);
  });

  it("builds a fixture product with a converted cost and stable names", () => {
    const raw = extractProduct(productHtml(), PRODUCT_URL);
    const product = toFixtureProduct(raw, new Date("2026-11-02T12:00:00Z"));

    expect(VES_PER_USD).toBeGreaterThan(0);
    expect(product).toEqual({
      external_id: "111934531",
      name: "Cereal Infantil Cerelac 400 g",
      description: "Alimento vitaminado con trigo.",
      reference: "FARMATODO-111934531",
      category: "Alimentos y Bebidas",
      tax_code: "IVA",
      cost: 1,
      image: {
        original: "111934531.webp",
        thumbnail: "111934531-thumb.webp",
        reference: "demo-farmatodo-111934531",
      },
      source_url: PRODUCT_URL,
      fetched_at: "2026-11-02T12:00:00.000Z",
    });
  });

  it("parses sitemap locations and ignores empty documents", () => {
    const xml = `<urlset><url><loc>https://a.test/1</loc></url><url><loc>https://a.test/2</loc></url></urlset>`;

    expect(parseSitemap(xml)).toEqual(["https://a.test/1", "https://a.test/2"]);
    expect(parseSitemap("<urlset></urlset>")).toEqual([]);
  });
});
