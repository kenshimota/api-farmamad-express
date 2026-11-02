const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const {
  collectValidProducts,
  writeFixtureAtomic,
} = require("./fixture-writer");

function product(overrides = {}) {
  const externalId = overrides.external_id ?? "1";

  return {
    external_id: externalId,
    name: `Producto ${externalId}`,
    description: "Descripción",
    reference: `FARMATODO-${externalId}`,
    category: "Medicamentos",
    tax_code: "IVA",
    cost: 1.5,
    image: {
      original: `${externalId}.webp`,
      thumbnail: `${externalId}-thumb.webp`,
      reference: `demo-farmatodo-${externalId}`,
    },
    source_url: `https://example.com/producto/${externalId}`,
    fetched_at: "2026-11-02T12:00:00.000Z",
    ...overrides,
  };
}

describe("fixture collection", () => {
  it("discards invalid products and deduplicates by external id", () => {
    const products = collectValidProducts(
      [
        product({ external_id: "1" }),
        product({ external_id: "1", name: "Duplicado" }),
        product({ external_id: "2", name: "" }),
        product({ external_id: "3", image: null }),
        product({ external_id: "4" }),
      ],
      { minimum: 2, limit: 10 },
    );

    expect(products.map((item) => item.external_id)).toEqual(["1", "4"]);
  });

  it("fails when there are fewer valid products than the minimum", () => {
    expect(() =>
      collectValidProducts([product({ external_id: "1" })], {
        minimum: 2,
        limit: 10,
      }),
    ).toThrow(/fewer than 2 valid products/);
  });

  it("caps the result at the requested limit", () => {
    const products = collectValidProducts(
      [product({ external_id: "1" }), product({ external_id: "2" })],
      { minimum: 1, limit: 1 },
    );

    expect(products).toHaveLength(1);
  });
});

describe("atomic fixture writing", () => {
  let directory;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "fixture-writer-"));
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  it("writes JSON and replaces the target atomically", async () => {
    const file = path.join(directory, "fixture.json");
    await fs.writeFile(file, '{"old":true}\n', "utf8");

    await writeFixtureAtomic(file, { products: [product()] });

    const stored = JSON.parse(await fs.readFile(file, "utf8"));
    expect(stored.products).toHaveLength(1);
    expect(
      (await fs.readdir(directory)).filter((name) => name.includes(".tmp-")),
    ).toEqual([]);
  });

  it("does not replace the previous fixture when writing fails", async () => {
    const file = path.join(directory, "fixture.json");
    await fs.writeFile(file, '{"old":true}\n', "utf8");
    const failingFs = {
      ...fs,
      rename: jest.fn(async () => {
        throw new Error("rename failed");
      }),
      unlink: fs.unlink.bind(fs),
    };

    await expect(
      writeFixtureAtomic(file, { products: [product()] }, failingFs),
    ).rejects.toThrow("rename failed");

    expect(await fs.readFile(file, "utf8")).toBe('{"old":true}\n');
  });
});
