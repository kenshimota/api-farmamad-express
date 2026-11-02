process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "farmamad-hu47-"));
process.env.UPLOAD_DIR = uploadDir;
process.env.PUBLIC_BASE_URL = "http://localhost:3001";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const Image = require("../models/image");
const Payment = require("../models/payment");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  buildFixture,
  createPendingPayment,
  resetDatabase,
} = require("../../test/helpers/payments");

/**
 * Builds a small PNG buffer.
 * @returns {Promise<Buffer>} Image bytes.
 */
function pngBuffer() {
  return sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: { r: 30, g: 100, b: 210 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Sends a multipart payment creation.
 * @param {object} fixture - Fixture.
 * @param {object} [options] - Request options.
 * @param {Buffer|null} [options.image] - Image bytes.
 * @param {string} [options.field] - File field name.
 * @param {number} [options.amount] - Amount.
 * @returns {Promise<import("supertest").Response>} Response.
 */
function createWithImage(
  fixture,
  { image, field = "image", amount = 100 } = {},
) {
  const req = request(app)
    .post("/payments")
    .set("Authorization", `Bearer ${fixture.sellerToken}`)
    .field("customer_id", `${fixture.customer.id}`)
    .field("method_payment_id", `${fixture.method.id}`)
    .field("amount", `${amount}`)
    .field("reference", "IMG-1");

  return image ? req.attach(field, image, "receipt.png") : req;
}

/**
 * Sends a multipart payment update.
 * @param {object} fixture - Fixture.
 * @param {number} id - Payment id.
 * @param {Buffer|null} image - New image bytes.
 * @returns {Promise<import("supertest").Response>} Response.
 */
function updateWithImage(fixture, id, image) {
  const req = request(app)
    .put(`/payments/${id}`)
    .set("Authorization", `Bearer ${fixture.sellerToken}`)
    .field("notes", "Comprobante corregido");

  return image ? req.attach("image", image, "receipt.png") : req;
}

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
  await Image.destroy({ where: {}, truncate: true, cascade: true });
  fs.rmSync(path.join(uploadDir, "payments"), {
    recursive: true,
    force: true,
  });
});

afterAll(async () => {
  await resetDatabase();
  await Image.destroy({ where: {}, truncate: true, cascade: true });
  await sequelize.close();
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

describe("payment reference image", () => {
  it("stores the original and thumbnail and assigns the image to the payment", async () => {
    const fixture = await buildFixture();

    const response = await createWithImage(fixture, {
      image: await pngBuffer(),
    });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("pending");
    expect(response.body.wallet).toBeNull();
    expect(response.body.reference_image_id).toEqual(expect.any(Number));
    expect(response.body.reference_image).toEqual({
      id: response.body.reference_image_id,
      url: expect.stringMatching(
        /^http:\/\/localhost:3001\/uploads\/payments\/.+\.png$/,
      ),
      pathname: expect.stringMatching(/^\/uploads\/payments\/.+\.png$/),
      reference: expect.stringMatching(/^payment-reference-/),
      thumbnail: expect.stringMatching(
        /^http:\/\/localhost:3001\/uploads\/payments\/.+-thumb\.webp$/,
      ),
    });

    const stored = await Image.findByPk(response.body.reference_image_id);
    expect(stored).toMatchObject({
      reference: expect.stringMatching(/^payment-reference-/),
    });
    const original = path.join(
      uploadDir,
      "payments",
      path.basename(stored.pathname),
    );
    const thumbnail = original.replace(/(\.[^.]+)$/, "-thumb.webp");
    expect(fs.existsSync(original)).toBe(true);
    expect(fs.existsSync(thumbnail)).toBe(true);
    expect((await sharp(thumbnail).metadata()).format).toBe("webp");
  });

  it("accepts a payment without an image", async () => {
    const fixture = await buildFixture();

    const response = await createWithImage(fixture);

    expect(response.status).toBe(201);
    expect(response.body.reference_image_id).toBeNull();
    expect(response.body.reference_image).toBeNull();
    expect(await Image.count()).toBe(0);
  });

  it("rejects invalid content with 422 and leaves no files", async () => {
    const fixture = await buildFixture();

    const response = await createWithImage(fixture, {
      image: Buffer.from("not an image"),
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { image: "Invalid image" } });
    expect(await Payment.count()).toBe(0);
    expect(await Image.count()).toBe(0);
    const paymentsDir = path.join(uploadDir, "payments");
    expect(
      fs.existsSync(paymentsDir) ? fs.readdirSync(paymentsDir) : [],
    ).toEqual([]);
  });

  it("rejects files above 5 MB with 413", async () => {
    const fixture = await buildFixture();

    const response = await createWithImage(fixture, {
      image: Buffer.alloc(5 * 1024 * 1024 + 1),
    });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ message: "Image too large" });
  });

  it("rejects a second file or an unexpected field with 400", async () => {
    const fixture = await buildFixture();
    const buffer = await pngBuffer();

    const second = await createWithImage(fixture, { image: buffer }).attach(
      "image",
      buffer,
      "other.png",
    );
    expect(second.status).toBe(400);

    const unexpected = await createWithImage(fixture, {
      image: buffer,
      field: "photo",
    });
    expect(unexpected.status).toBe(400);
  });

  it("replaces the image keeping the previous row and file", async () => {
    const fixture = await buildFixture();
    const created = await createWithImage(fixture, {
      image: await pngBuffer(),
    });
    const firstImageId = created.body.reference_image_id;
    const firstStored = await Image.findByPk(firstImageId);
    const firstFile = path.join(
      uploadDir,
      "payments",
      path.basename(firstStored.pathname),
    );

    const updated = await updateWithImage(
      fixture,
      created.body.id,
      await pngBuffer(),
    );

    expect(updated.status).toBe(202);
    expect(updated.body.reference_image_id).not.toBe(firstImageId);
    expect(updated.body.notes).toBe("Comprobante corregido");
    expect(await Image.count()).toBe(2);
    expect(await Image.findByPk(firstImageId)).not.toBeNull();
    expect(fs.existsSync(firstFile)).toBe(true);
  });

  it("accepts a PUT with only a new image", async () => {
    const fixture = await buildFixture();
    const created = await createPendingPayment(fixture);

    const response = await updateWithImage(
      fixture,
      created.body.id,
      await pngBuffer(),
    );

    expect(response.status).toBe(202);
    expect(response.body.reference_image_id).toEqual(expect.any(Number));
  });

  it("exposes the image in the listing and the detail", async () => {
    const fixture = await buildFixture();
    const created = await createWithImage(fixture, {
      image: await pngBuffer(),
    });

    const list = await as("get", "/payments", fixture.sellerToken);
    const detail = await as(
      "get",
      `/payments/${created.body.id}`,
      fixture.customerToken,
    );

    expect(list.body[0].reference_image_id).toBe(
      created.body.reference_image_id,
    );
    expect(list.body[0].reference_image.reference).toMatch(
      /^payment-reference-/,
    );
    expect(detail.body.reference_image.reference).toMatch(
      /^payment-reference-/,
    );
    expect(detail.body).not.toHaveProperty("history");
  });

  it("deletes the unreferenced image and its files with the payment", async () => {
    const fixture = await buildFixture();
    const created = await createWithImage(fixture, {
      image: await pngBuffer(),
    });
    const image = await Image.findByPk(created.body.reference_image_id);
    const original = path.join(
      uploadDir,
      "payments",
      path.basename(image.pathname),
    );
    const thumbnail = original.replace(/(\.[^.]+)$/, "-thumb.webp");

    const response = await as(
      "delete",
      `/payments/${created.body.id}`,
      fixture.adminToken,
    );

    expect(response.status).toBe(204);
    expect(await Image.findByPk(image.id)).toBeNull();
    expect(fs.existsSync(original)).toBe(false);
    expect(fs.existsSync(thumbnail)).toBe(false);
  });
});
