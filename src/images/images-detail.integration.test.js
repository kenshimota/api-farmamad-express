process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const Image = require("../models/image");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  PUBLIC_IMAGE,
  as,
  createImage,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/images");
const { createProduct } = require("../../test/helpers/products");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await sequelize.close();
});

describe("PUT /images/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update the image and answers 202",
    async (role) => {
      const image = await createImage();
      const token = await tokenFor(role);
      const changes = {
        url: "https://cdn.farmamad.com/products/paracetamol.png",
        pathname: "/uploads/products/paracetamol.png",
        reference: "paracetamol-500",
        thumbnail: "https://cdn.farmamad.com/products/paracetamol-thumb.png",
      };

      const response = await as("put", `/images/${image.id}`, token).send(
        changes,
      );

      expect(response.status).toBe(202);
      expect(response.body).toEqual({ id: image.id, ...changes });

      const stored = await Image.findByPk(image.id);
      expect(stored.reference).toBe(changes.reference);
    },
  );

  it("stores a null pathname when it is omitted", async () => {
    const image = await createImage();
    const token = await tokenFor("admin");
    const { pathname, ...withoutPathname } = BODY;

    const response = await as("put", `/images/${image.id}`, token).send(
      withoutPathname,
    );

    expect(response.status).toBe(202);
    expect(response.body.pathname).toBeNull();

    const stored = await Image.findByPk(image.id);
    expect(stored.pathname).toBeNull();
  });

  it("stores a null pathname when it is explicitly null", async () => {
    const image = await createImage();
    const token = await tokenFor("admin");

    const response = await as("put", `/images/${image.id}`, token).send({
      ...BODY,
      pathname: null,
    });

    expect(response.status).toBe(202);
    expect(response.body.pathname).toBeNull();

    const stored = await Image.findByPk(image.id);
    expect(stored.pathname).toBeNull();
  });

  it("trims reference and pathname before storing them", async () => {
    const image = await createImage();
    const token = await tokenFor("admin");

    const response = await as("put", `/images/${image.id}`, token).send({
      ...BODY,
      reference: "  ibuprofeno-800  ",
      pathname: "  /uploads/products/ibuprofeno-800.png  ",
    });

    expect(response.status).toBe(202);
    expect(response.body.reference).toBe("ibuprofeno-800");
    expect(response.body.pathname).toBe("/uploads/products/ibuprofeno-800.png");
  });

  it("responds 409 when the reference belongs to another image", async () => {
    await createImage();
    const other = await createImage({
      reference: "paracetamol-500",
      url: "https://cdn.farmamad.com/products/paracetamol.png",
      thumbnail: "https://cdn.farmamad.com/products/paracetamol-thumb.png",
    });
    const token = await tokenFor("seller");

    const response = await as("put", `/images/${other.id}`, token).send(BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Image already exists" });
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("put", "/images/99999", token).send(BODY);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Image not found" });

    const invalid = await as("put", "/images/0", token).send(BODY);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid image id" } });
  });

  it("responds 400 and 422 for missing and invalid fields", async () => {
    const image = await createImage();
    const token = await tokenFor("admin");

    const missing = await as("put", `/images/${image.id}`, token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message: "url, reference and thumbnail are required",
    });

    const invalid = await as("put", `/images/${image.id}`, token).send({
      ...BODY,
      thumbnail: "not-a-url",
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { thumbnail: "Miniatura inválida" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const image = await createImage();
    const token = await tokenFor("dispatcher");

    const response = await as("put", `/images/${image.id}`, token).send(BODY);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});

describe("DELETE /images/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to delete the image and answers 204",
    async (role) => {
      const image = await createImage();
      const token = await tokenFor(role);

      const response = await as("delete", `/images/${image.id}`, token);

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      await expect(Image.findByPk(image.id)).resolves.toBeNull();
    },
  );

  it("responds 409 and keeps the image when a product references it", async () => {
    const image = await createImage();
    const token = await tokenFor("admin");
    const product = await createProduct({
      image_id: image.id,
      reference: "image-usage",
    });

    try {
      const response = await as("delete", `/images/${image.id}`, token);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Image is in use" });
      await expect(Image.findByPk(image.id)).resolves.not.toBeNull();
    } finally {
      await product.destroy();
    }
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("delete", "/images/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Image not found" });

    const invalid = await as("delete", "/images/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid image id" } });
  });

  it("responds 403 for a dispatcher user", async () => {
    const image = await createImage();
    const token = await tokenFor("dispatcher");

    const response = await as("delete", `/images/${image.id}`, token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("responds 401 without a token", async () => {
    const image = await createImage();
    const response = await request(app).delete(`/images/${image.id}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
