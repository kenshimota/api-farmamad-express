process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
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

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterAll(async () => {
  await sequelize.close();
});

describe("POST /images with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create an image and answers 201",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("post", "/images", token).send(BODY);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(PUBLIC_IMAGE);
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");

      const stored = await Image.findByPk(response.body.id);
      expect(stored.url).toBe(BODY.url);
      expect(stored.reference).toBe(BODY.reference);
    },
  );

  it("stores a null pathname when it is omitted", async () => {
    const token = await tokenFor("admin");
    const { pathname, ...withoutPathname } = BODY;

    const response = await as("post", "/images", token).send(withoutPathname);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ...PUBLIC_IMAGE, pathname: null });

    const stored = await Image.findByPk(response.body.id);
    expect(stored.pathname).toBeNull();
  });

  it("stores a null pathname when it is explicitly null", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/images", token).send({
      ...BODY,
      pathname: null,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ...PUBLIC_IMAGE, pathname: null });

    const stored = await Image.findByPk(response.body.id);
    expect(stored.pathname).toBeNull();
  });

  it("trims reference and pathname before storing them", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/images", token).send({
      ...BODY,
      reference: "  ibuprofeno-400  ",
      pathname: "  /uploads/products/ibuprofeno.png  ",
    });

    expect(response.status).toBe(201);
    expect(response.body.reference).toBe(BODY.reference);
    expect(response.body.pathname).toBe(BODY.pathname);
  });

  it("discards unknown and audit fields", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/images", token).send({
      ...BODY,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body.id).not.toBe(99);
  });

  it("responds 409 when the reference already exists", async () => {
    await createImage();
    const token = await tokenFor("admin");

    const response = await as("post", "/images", token).send(BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Image already exists" });
  });

  it("responds 401 without a token", async () => {
    const response = await request(app).post("/images").send(BODY);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("post", "/images", token).send(BODY);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 400 and 422 for missing and invalid fields", async () => {
    const token = await tokenFor("admin");

    const missing = await as("post", "/images", token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message: "url, reference and thumbnail are required",
    });

    const invalid = await as("post", "/images", token).send({
      ...BODY,
      url: "not-a-url",
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { url: "URL inválida" } });
  });

  it("responds 403 for a blocked user", async () => {
    const token = await tokenFor("admin");
    await User.update({ isBlocked: true }, { where: { username: "admin" } });

    const response = await as("get", "/images", token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});

describe("GET /images with a real database", () => {
  it("returns the images ordered by id with public fields", async () => {
    const first = await createImage();
    const second = await createImage({
      reference: "paracetamol-500",
      url: "https://cdn.farmamad.com/products/paracetamol.png",
      pathname: null,
      thumbnail: "https://cdn.farmamad.com/products/paracetamol-thumb.png",
    });
    const token = await tokenFor("dispatcher");

    const response = await as("get", "/images", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { ...PUBLIC_IMAGE, id: first.id },
      {
        id: second.id,
        url: "https://cdn.farmamad.com/products/paracetamol.png",
        pathname: null,
        reference: "paracetamol-500",
        thumbnail: "https://cdn.farmamad.com/products/paracetamol-thumb.png",
      },
    ]);
  });

  it("returns an empty array when there are no images", async () => {
    const token = await tokenFor("admin");

    const response = await as("get", "/images", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each([
    "admin",
    "seller",
    "dispatcher",
    "manager_warehouse",
    "support",
    "customer",
  ])("allows a %s to read the list", async (role) => {
    await createImage();
    const token = await tokenFor(role);

    const response = await as("get", "/images", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([PUBLIC_IMAGE]);
  });
});

describe("GET /images/:id with a real database", () => {
  it("returns one image for the allowed roles", async () => {
    const image = await createImage();
    const token = await tokenFor("customer");

    const response = await as("get", `/images/${image.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...PUBLIC_IMAGE, id: image.id });
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("get", "/images/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Image not found" });

    const invalid = await as("get", "/images/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid image id" } });
  });
});
