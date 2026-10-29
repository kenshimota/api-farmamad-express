process.env.JWT_SECRET = "test-secret";

jest.mock("../models/image", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const Image = require("../models/image");
const User = require("../models/user");
const imagesRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/images", imagesRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const validBody = {
  url: "https://cdn.farmamad.com/products/ibuprofeno.png",
  pathname: "/uploads/products/ibuprofeno.png",
  reference: "ibuprofeno-400",
  thumbnail: "https://cdn.farmamad.com/products/ibuprofeno-thumb.png",
};

/**
 * Signs a JWT for the given role.
 * @param {string} [role] - Role name to embed in the token.
 * @returns {string} Signed JWT.
 */
function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "admin", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Builds a stored image double as returned by Sequelize.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The image double.
 */
function storedImage(overrides = {}) {
  return {
    id: 1,
    ...validBody,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

/**
 * Sends a POST /images request.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body, token = tokenFor()) {
  const req = request(app).post("/images");

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  Image.create.mockReset();
  Image.findAll.mockReset();
  Image.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("POST /images", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create an image and answers 201",
    async (role) => {
      Image.create.mockResolvedValue(storedImage());

      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: 1, ...validBody });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
      expect(Image.create).toHaveBeenCalledWith(validBody);
    },
  );

  it("stores a null pathname when it is omitted", async () => {
    const { pathname, ...withoutPathname } = validBody;
    Image.create.mockResolvedValue(storedImage({ pathname: null }));

    const response = await post(withoutPathname);

    expect(response.status).toBe(201);
    expect(response.body.pathname).toBeNull();
    expect(Image.create).toHaveBeenCalledWith({
      ...withoutPathname,
      pathname: null,
    });
  });

  it("stores a null pathname when it is explicitly null", async () => {
    Image.create.mockResolvedValue(storedImage({ pathname: null }));

    const response = await post({ ...validBody, pathname: null });

    expect(response.status).toBe(201);
    expect(response.body.pathname).toBeNull();
    expect(Image.create).toHaveBeenCalledWith({
      ...validBody,
      pathname: null,
    });
  });

  it("trims reference and pathname before persisting them", async () => {
    Image.create.mockResolvedValue(storedImage());

    const response = await post({
      ...validBody,
      reference: "  ibuprofeno-400  ",
      pathname: "  /uploads/products/ibuprofeno.png  ",
    });

    expect(response.status).toBe(201);
    expect(Image.create).toHaveBeenCalledWith(validBody);
  });

  it("drops unknown and audit fields", async () => {
    Image.create.mockResolvedValue(storedImage());

    const response = await post({
      ...validBody,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(Image.create).toHaveBeenCalledWith(validBody);
  });

  it("responds 409 when the reference already exists", async () => {
    Image.create.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );

    const response = await post(validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Image already exists" });
  });

  it("responds 401 when the token is missing", async () => {
    const response = await post(validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Image.create).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await post(validBody, "not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Image.create).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Image.create).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await post(validBody);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(Image.create).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { url: validBody.url },
    { url: validBody.url, reference: validBody.reference },
  ])("responds 400 when fields are missing in %p", async (body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "url, reference and thumbnail are required",
    });
    expect(Image.create).not.toHaveBeenCalled();
  });

  it("responds 422 when a field is invalid", async () => {
    const response = await post({ ...validBody, thumbnail: "not-a-url" });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { thumbnail: "Miniatura inválida" },
    });
    expect(Image.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    Image.create.mockRejectedValue(new Error("database exploded"));

    const response = await post(validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});

describe("router composition", () => {
  it("mounts the list router on GET /images", async () => {
    Image.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get("/images")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(Image.findAll).toHaveBeenCalledWith({ order: [["id", "ASC"]] });
  });

  it("mounts the update router on PUT /images/:id", async () => {
    const image = storedImage({
      update: jest.fn(function update(values) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
    });
    Image.findByPk.mockResolvedValue(image);

    const response = await request(app)
      .put("/images/1")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ ...validBody, reference: "paracetamol-500" });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      id: 1,
      ...validBody,
      reference: "paracetamol-500",
    });
    expect(image.update).toHaveBeenCalledWith({
      ...validBody,
      reference: "paracetamol-500",
    });
  });

  it("mounts the remove router on DELETE /images/:id", async () => {
    const image = storedImage({
      destroy: jest.fn().mockResolvedValue(),
    });
    Image.findByPk.mockResolvedValue(image);

    const response = await request(app)
      .delete("/images/1")
      .set("Authorization", `Bearer ${tokenFor()}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(image.destroy).toHaveBeenCalledTimes(1);
  });
});
