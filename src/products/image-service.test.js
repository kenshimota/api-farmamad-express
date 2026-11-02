const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const {
  InvalidImageDimensionsError,
  InvalidImageError,
} = require("./image-errors");
const {
  MAX_DIMENSION,
  MAX_PIXELS,
  MAX_UPLOAD_BYTES,
  THUMBNAIL_QUALITY,
  THUMBNAIL_SIZE,
  processUploadedImage,
  removeFiles,
  validateDimensions,
} = require("./image-service");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let uploadDir;

/**
 * Builds an in-memory image with the requested format and size.
 * @param {string} format - Sharp output format.
 * @param {object} [options] - Creation options.
 * @param {number} [options.width] - Image width.
 * @param {number} [options.height] - Image height.
 * @returns {Promise<Buffer>} Encoded image buffer.
 */
function imageBuffer(format, { width = 640, height = 480 } = {}) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 10, g: 120, b: 200 },
    },
  })
    [format]()
    .toBuffer();
}

/**
 * Builds a fake metadata object for the dimension validator.
 * @param {object} [overrides] - Metadata overrides.
 * @returns {object} Metadata double.
 */
function metadata(overrides = {}) {
  return { format: "png", width: 100, height: 100, ...overrides };
}

beforeEach(async () => {
  uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "farmamad-hu37-"));
  process.env.UPLOAD_DIR = uploadDir;
  delete process.env.PUBLIC_BASE_URL;
});

afterEach(async () => {
  delete process.env.UPLOAD_DIR;
  delete process.env.PUBLIC_BASE_URL;
  await fs.rm(uploadDir, { recursive: true, force: true });
});

describe("constants", () => {
  it("exposes the documented limits", () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_DIMENSION).toBe(6000);
    expect(MAX_PIXELS).toBe(25 * 1000 * 1000);
    expect(THUMBNAIL_SIZE).toBe(320);
    expect(THUMBNAIL_QUALITY).toBe(80);
  });
});

describe("validateDimensions", () => {
  it.each([
    ["the maximum width", metadata({ width: 6000, height: 1 })],
    ["exactly 25 megapixels", metadata({ width: 5000, height: 5000 })],
    ["small images", metadata({ width: 1, height: 1 })],
  ])("accepts %s", (_case, value) => {
    expect(() => validateDimensions(value)).not.toThrow();
  });

  it.each([
    ["a width above the limit", metadata({ width: 6001, height: 1 })],
    ["a height above the limit", metadata({ width: 1, height: 6001 })],
    ["more than 25 megapixels", metadata({ width: 5001, height: 5001 })],
    ["missing dimensions", metadata({ width: undefined, height: undefined })],
  ])("rejects %s", (_case, value) => {
    expect(() => validateDimensions(value)).toThrow(
      InvalidImageDimensionsError,
    );
  });
});

describe("processUploadedImage", () => {
  it.each([
    ["jpeg", "jpg"],
    ["png", "png"],
    ["webp", "webp"],
  ])("stores a %s original and a WebP thumbnail", async (format, extension) => {
    const file = { buffer: await imageBuffer(format) };

    const result = await processUploadedImage(file);

    expect(result.image.reference).toMatch(/^product-[0-9a-f-]{36}$/);
    expect(result.image.pathname).toMatch(
      new RegExp(`^/uploads/products/[0-9a-f-]{36}\\.${extension}$`),
    );
    expect(result.image.url).toBe(
      `http://localhost:3001${result.image.pathname}`,
    );
    expect(result.image.thumbnail).toMatch(
      /^http:\/\/localhost:3001\/uploads\/products\/[0-9a-f-]{36}-thumb\.webp$/,
    );
    expect(result.files).toHaveLength(2);
    expect(path.dirname(result.files[0])).toBe(
      path.join(uploadDir, "products"),
    );
    expect(path.basename(result.files[0])).toMatch(
      new RegExp(`^[0-9a-f-]{36}\\.${extension}$`),
    );
    expect(path.basename(result.files[1])).toMatch(
      /^[0-9a-f-]{36}-thumb\.webp$/,
    );

    const [original, thumbnail] = await Promise.all([
      fs.readFile(result.files[0]),
      fs.readFile(result.files[1]),
    ]);
    const thumbnailMetadata = await sharp(thumbnail).metadata();

    expect(original.length).toBeGreaterThan(0);
    expect(thumbnailMetadata.format).toBe("webp");
    expect(thumbnailMetadata.width).toBeLessThanOrEqual(THUMBNAIL_SIZE);
    expect(thumbnailMetadata.height).toBeLessThanOrEqual(THUMBNAIL_SIZE);
  });

  it("uses a fresh UUID and ignores the client file name", async () => {
    const first = await processUploadedImage({
      buffer: await imageBuffer("png"),
      originalname: "evil/../../script.png",
    });
    const second = await processUploadedImage({
      buffer: await imageBuffer("png"),
      originalname: "evil/../../script.png",
    });

    expect(first.image.reference).not.toBe(second.image.reference);
    expect(
      UUID_PATTERN.test(first.image.reference.slice("product-".length)),
    ).toBe(true);
    expect(first.image.pathname).not.toContain("evil");
    expect(first.image.pathname).not.toContain("script");
  });

  it("keeps the thumbnail inside 320x320 without enlarging small images", async () => {
    const result = await processUploadedImage({
      buffer: await imageBuffer("png", { width: 100, height: 40 }),
    });
    const thumbnail = await sharp(result.files[1]).metadata();

    expect(thumbnail.width).toBe(100);
    expect(thumbnail.height).toBe(40);
  });

  it("keeps the aspect ratio of the thumbnail", async () => {
    const result = await processUploadedImage({
      buffer: await imageBuffer("jpeg", { width: 1280, height: 640 }),
    });
    const thumbnail = await sharp(result.files[1]).metadata();

    expect(thumbnail.width).toBe(320);
    expect(thumbnail.height).toBe(160);
  });

  it.each([
    ["an empty buffer", Buffer.alloc(0)],
    ["random bytes", Buffer.from("definitely not an image")],
    ["an SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
  ])("rejects %s as an invalid image", async (_case, buffer) => {
    await expect(processUploadedImage({ buffer })).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });

  it("rejects truncated images whose header is readable", async () => {
    const buffer = (await imageBuffer("png")).subarray(0, 100);

    await expect(processUploadedImage({ buffer })).rejects.toBeInstanceOf(
      InvalidImageError,
    );
    await expect(fs.readdir(path.join(uploadDir, "products"))).resolves.toEqual(
      [],
    );
  });

  it("rejects GIF files even when sharp can read them", async () => {
    const buffer = await imageBuffer("gif");

    await expect(processUploadedImage({ buffer })).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });

  it("rejects images above the dimension limits", async () => {
    const buffer = await imageBuffer("png", { width: 6001, height: 1 });

    await expect(processUploadedImage({ buffer })).rejects.toBeInstanceOf(
      InvalidImageDimensionsError,
    );
  });

  it("leaves no files behind when the image is invalid", async () => {
    await expect(
      processUploadedImage({ buffer: Buffer.from("broken") }),
    ).rejects.toBeInstanceOf(InvalidImageError);

    await expect(fs.readdir(uploadDir)).resolves.toEqual([]);
  });
});

describe("removeFiles", () => {
  it("deletes every existing file and ignores missing ones", async () => {
    const keep = path.join(uploadDir, "keep.txt");
    const remove = path.join(uploadDir, "remove.txt");
    await Promise.all([fs.writeFile(keep, "keep"), fs.writeFile(remove, "x")]);

    await removeFiles([remove, path.join(uploadDir, "missing.txt")]);

    await expect(fs.stat(remove)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.readFile(keep, "utf8")).resolves.toBe("keep");
  });
});
