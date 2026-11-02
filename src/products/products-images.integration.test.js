process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const fs = require("fs/promises");
const request = require("supertest");
const sharp = require("sharp");

const {
  PUBLIC_BASE_URL,
  UUID_PATTERN,
  configureUploadEnvironment,
  getProductsDir,
  imageFields,
  pngBuffer,
  postImage,
  putImage,
  removeUploads,
  resetUploads,
  storedFiles,
} = require("../../test/helpers/product-uploads");

configureUploadEnvironment();

const app = require("../app");
const sequelize = require("../database");
const Image = require("../models/image");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  as,
  createCategory,
  createImage,
  createProduct,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/products");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
  await resetUploads();
});

afterAll(async () => {
  await removeUploads();
  await sequelize.close();
});

describe("POST /products with multipart/form-data", () => {
  it("stores the original, the thumbnail, the image row and serves /uploads", async () => {
    const token = await tokenFor("admin");
    const category = await createCategory();
    const fields = imageFields(category.id);

    const response = await postImage(app, token, fields, pngBuffer(640, 480));

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      ...fields,
      image_id: expect.any(Number),
    });

    const image = await Image.findByPk(response.body.image_id);
    expect(image.reference).toMatch(new RegExp(`^product-${UUID_PATTERN}$`));
    expect(image.pathname).toMatch(
      new RegExp(`^/uploads/products/${UUID_PATTERN}\\.png$`),
    );
    expect(image.url).toBe(`${PUBLIC_BASE_URL}${image.pathname}`);
    expect(image.thumbnail).toMatch(
      new RegExp(
        `^${PUBLIC_BASE_URL}/uploads/products/${UUID_PATTERN}-thumb\\.webp$`,
      ),
    );

    const files = storedFiles(image);
    const [original, thumbnail] = await Promise.all([
      fs.readFile(files.original),
      fs.readFile(files.thumbnail),
    ]);
    const thumbnailMetadata = await sharp(thumbnail).metadata();

    expect(original.length).toBeGreaterThan(0);
    expect(thumbnailMetadata.format).toBe("webp");
    expect(thumbnailMetadata.width).toBe(320);
    expect(thumbnailMetadata.height).toBe(240);

    const servedOriginal = await request(app).get(image.pathname);
    expect(servedOriginal.status).toBe(200);
    expect(servedOriginal.headers["content-type"]).toMatch(/^image\/png/);

    const servedThumbnail = await request(app).get(
      `/uploads/products/${files.uuid}-thumb.webp`,
    );
    expect(servedThumbnail.status).toBe(200);
    expect(servedThumbnail.headers["content-type"]).toMatch(/^image\/webp/);
  });

  it("keeps the previous image row and files when a product is updated", async () => {
    const token = await tokenFor("seller");
    const category = await createCategory();
    const fields = imageFields(category.id);
    const created = await postImage(app, token, fields, await pngBuffer());
    const previous = await Image.findByPk(created.body.image_id);
    const previousFiles = storedFiles(previous);

    const updated = await putImage(
      app,
      token,
      created.body.id,
      { ...fields, name: "Ibuprofeno 800 mg", reference: "IBU-800" },
      await pngBuffer(300, 300),
    );

    expect(updated.status).toBe(202);
    expect(updated.body.image_id).not.toBe(previous.id);
    await expect(Image.findByPk(previous.id)).resolves.not.toBeNull();
    await expect(fs.stat(previousFiles.original)).resolves.toBeDefined();
    await expect(fs.stat(previousFiles.thumbnail)).resolves.toBeDefined();

    const current = await Image.findByPk(updated.body.image_id);
    const currentFiles = storedFiles(current);
    await expect(fs.stat(currentFiles.original)).resolves.toBeDefined();
    await expect(fs.stat(currentFiles.thumbnail)).resolves.toBeDefined();
  });

  it("keeps the JSON flow with image_id working for create and update", async () => {
    const token = await tokenFor("admin");
    const category = await createCategory();
    const image = await createImage();
    const created = await as("post", "/products", token).send({
      ...BODY,
      category_id: category.id,
      image_id: image.id,
    });

    expect(created.status).toBe(201);
    expect(created.body.image_id).toBe(image.id);

    const updated = await as("put", `/products/${created.body.id}`, token).send(
      {
        ...BODY,
        name: "Ibuprofeno 800 mg",
        reference: "IBU-800",
        category_id: category.id,
        image_id: image.id,
      },
    );

    expect(updated.status).toBe(202);
    expect(updated.body.image_id).toBe(image.id);
  });

  it("rolls back the image and removes the files when the product insert fails", async () => {
    const token = await tokenFor("admin");
    const category = await createCategory();
    await createProduct({
      reference: BODY.reference,
      category_id: category.id,
    });
    const imagesBefore = await Image.count();

    const response = await postImage(
      app,
      token,
      imageFields(category.id, { reference: BODY.reference }),
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Product already exists" });
    expect(await Image.count()).toBe(imagesBefore);
    await expect(fs.readdir(getProductsDir())).resolves.toEqual([]);
  });
});
