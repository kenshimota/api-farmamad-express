const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const {
  PROCESSED_ORIGINAL_MAX,
  THUMBNAIL_SIZE,
  processProductImage,
  validateImageAsset,
} = require("./image-assets");

async function sourcePng(width = 900, height = 600) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 30, g: 140, b: 220 },
    },
  })
    .png()
    .toBuffer();
}

describe("demo image processing", () => {
  let directory;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "demo-images-"));
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  it("converts a real image to WebP and creates a 320px thumbnail", async () => {
    const originalPath = path.join(directory, "1.webp");
    const thumbnailPath = path.join(directory, "1-thumb.webp");

    await processProductImage(await sourcePng(), {
      originalPath,
      thumbnailPath,
    });

    const original = await sharp(originalPath).metadata();
    const thumbnail = await sharp(thumbnailPath).metadata();

    expect(original.format).toBe("webp");
    expect(original.width).toBeLessThanOrEqual(PROCESSED_ORIGINAL_MAX);
    expect(thumbnail.format).toBe("webp");
    expect(thumbnail.width).toBe(THUMBNAIL_SIZE);
  });

  it("validates a stored WebP asset", async () => {
    const file = path.join(directory, "asset.webp");

    await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .webp()
      .toFile(file);

    await expect(validateImageAsset(file)).resolves.toEqual(
      expect.objectContaining({ format: "webp", width: 320 }),
    );
  });

  it("rejects content that is not a real image", async () => {
    const file = path.join(directory, "broken.webp");
    await fs.writeFile(file, "not an image", "utf8");

    await expect(validateImageAsset(file)).rejects.toThrow(/valid image/i);
  });
});
