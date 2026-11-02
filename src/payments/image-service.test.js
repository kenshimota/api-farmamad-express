const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const { InvalidImageError } = require("../products/image-errors");
const {
  processPaymentImage,
  removePaymentImageFiles,
} = require("./image-service");

let uploadDir;

/**
 * Builds a small PNG buffer.
 * @returns {Promise<Buffer>} The image bytes.
 */
function pngBuffer() {
  return sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: { r: 5, g: 100, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

beforeEach(async () => {
  uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "farmamad-hu47-"));
  process.env.UPLOAD_DIR = uploadDir;
  delete process.env.PUBLIC_BASE_URL;
});

afterEach(async () => {
  delete process.env.UPLOAD_DIR;
  delete process.env.PUBLIC_BASE_URL;
  await fs.rm(uploadDir, { recursive: true, force: true });
});

describe("payment image service", () => {
  it("stores the original and thumbnail under uploads/payments", async () => {
    const result = await processPaymentImage({ buffer: await pngBuffer() });

    expect(result.image.reference).toMatch(/^payment-reference-[0-9a-f-]{36}$/);
    expect(result.image.pathname).toMatch(
      /^\/uploads\/payments\/[0-9a-f-]{36}\.png$/,
    );
    expect(result.image.url).toBe(
      `http://localhost:3001${result.image.pathname}`,
    );
    expect(result.image.thumbnail).toMatch(
      /^http:\/\/localhost:3001\/uploads\/payments\/[0-9a-f-]{36}-thumb\.webp$/,
    );
    expect(result.files).toHaveLength(2);
    expect(path.dirname(result.files[0])).toBe(
      path.join(uploadDir, "payments"),
    );

    const metadata = await sharp(result.files[1]).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBeLessThanOrEqual(320);
  });

  it("rejects invalid content without leaving files", async () => {
    await expect(
      processPaymentImage({ buffer: Buffer.from("not an image") }),
    ).rejects.toBeInstanceOf(InvalidImageError);

    await expect(fs.readdir(uploadDir)).resolves.toEqual([]);
  });

  it("removes the stored payment original and thumbnail", async () => {
    const result = await processPaymentImage({ buffer: await pngBuffer() });

    await removePaymentImageFiles(result.image);

    await expect(fs.stat(result.files[0])).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(fs.stat(result.files[1])).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
