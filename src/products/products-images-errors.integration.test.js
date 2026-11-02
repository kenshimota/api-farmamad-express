process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const fs = require("fs/promises");

const {
  configureUploadEnvironment,
  getProductsDir,
  imageFields,
  pngBuffer,
  postImage,
  removeUploads,
  resetUploads,
} = require("../../test/helpers/product-uploads");

configureUploadEnvironment();

const app = require("../app");
const sequelize = require("../database");
const Image = require("../models/image");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  createCategory,
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

describe("POST /products upload errors", () => {
  it("responds 400 when neither image nor image_id is sent", async () => {
    const token = await tokenFor("admin");
    const category = await createCategory();

    const response = await postImage(
      app,
      token,
      imageFields(category.id),
      null,
      { attach: false },
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "image or image_id is required",
    });
  });

  it("responds 422 when image and image_id are combined", async () => {
    const token = await tokenFor("admin");
    const category = await createCategory();

    const response = await postImage(app, token, {
      ...imageFields(category.id),
      image_id: 1,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { image_id: "image_id cannot be combined with image" },
    });
    expect(await Image.count()).toBe(0);
  });

  it("responds 422 for corrupt or unsupported files", async () => {
    const token = await tokenFor("admin");
    const category = await createCategory();

    const corrupt = await postImage(
      app,
      token,
      imageFields(category.id),
      Buffer.from("not-an-image"),
    );
    expect(corrupt.status).toBe(422);
    expect(corrupt.body).toEqual({ errors: { image: "Invalid image" } });

    const gif = await postImage(
      app,
      token,
      imageFields(category.id),
      Buffer.from("GIF89a"),
    );
    expect(gif.status).toBe(422);
    expect(gif.body).toEqual({ errors: { image: "Invalid image" } });
    expect(await Image.count()).toBe(0);
  });

  it("responds 422 when the dimensions are out of range", async () => {
    const token = await tokenFor("admin");
    const category = await createCategory();

    const response = await postImage(
      app,
      token,
      imageFields(category.id),
      await pngBuffer(6001, 1),
    );

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { image: "Invalid image dimensions" },
    });
    expect(await Image.count()).toBe(0);
  });

  it("responds 413 when the file exceeds 5 MB", async () => {
    const token = await tokenFor("admin");
    const category = await createCategory();

    const response = await postImage(
      app,
      token,
      imageFields(category.id),
      Buffer.alloc(5 * 1024 * 1024 + 1),
    );

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ message: "Image too large" });
  });

  it("responds 400 for a file in an unexpected field", async () => {
    const token = await tokenFor("admin");
    const category = await createCategory();

    const response = await postImage(
      app,
      token,
      imageFields(category.id),
      await pngBuffer(),
      { field: "file" },
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Unexpected field" });
  });

  it("responds 401 and 403 before reading the file", async () => {
    const category = await createCategory();
    const unauthenticated = await postImage(
      app,
      "not-a-jwt",
      imageFields(category.id),
    );
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body).toEqual({ message: "Unauthorized" });

    const dispatcher = await tokenFor("dispatcher");
    const forbidden = await postImage(
      app,
      dispatcher,
      imageFields(category.id),
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
    expect(await Image.count()).toBe(0);
  });

  it("does not leave files behind after a rejected upload", async () => {
    const token = await tokenFor("admin");
    const category = await createCategory();
    await createProduct({
      reference: BODY.reference,
      category_id: category.id,
    });

    const response = await postImage(
      app,
      token,
      imageFields(category.id, { reference: BODY.reference }),
    );

    expect(response.status).toBe(409);
    await expect(fs.readdir(getProductsDir())).resolves.toEqual([]);
  });
});
