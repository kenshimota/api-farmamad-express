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
const updateRouter = require("./update");

const app = express();
app.use(express.json());
app.use("/images", updateRouter);
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
 * Builds a stored image double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The image double.
 */
function target(overrides = {}) {
  return {
    id: 1,
    ...validBody,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

/**
 * Sends a PUT /images/:id request.
 * @param {string} id - Route parameter.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function put(id, body, token = tokenFor()) {
  const req = request(app).put(`/images/${id}`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  Image.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("PUT /images/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update the image and answers 202",
    async (role) => {
      const image = target();
      Image.findByPk.mockResolvedValue(image);

      const response = await put("1", validBody, tokenFor(role));

      expect(response.status).toBe(202);
      expect(response.body).toEqual({ id: 1, ...validBody });
      expect(image.update).toHaveBeenCalledWith(validBody);
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("trims reference and pathname before persisting them", async () => {
    const image = target();
    Image.findByPk.mockResolvedValue(image);

    const response = await put("1", {
      ...validBody,
      reference: "  ibuprofeno-400  ",
      pathname: "  /uploads/products/ibuprofeno.png  ",
    });

    expect(response.status).toBe(202);
    expect(image.update).toHaveBeenCalledWith(validBody);
  });

  it("stores a null pathname when it is omitted", async () => {
    const image = target();
    Image.findByPk.mockResolvedValue(image);
    const { pathname, ...withoutPathname } = validBody;

    const response = await put("1", withoutPathname);

    expect(response.status).toBe(202);
    expect(image.update).toHaveBeenCalledWith({
      ...withoutPathname,
      pathname: null,
    });
    expect(response.body.pathname).toBeNull();
  });

  it("stores a null pathname when it is explicitly null", async () => {
    const image = target();
    Image.findByPk.mockResolvedValue(image);

    const response = await put("1", { ...validBody, pathname: null });

    expect(response.status).toBe(202);
    expect(image.update).toHaveBeenCalledWith({
      ...validBody,
      pathname: null,
    });
    expect(response.body.pathname).toBeNull();
  });

  it("drops unknown and audit fields", async () => {
    const image = target();
    Image.findByPk.mockResolvedValue(image);

    const response = await put("1", {
      ...validBody,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(202);
    expect(image.update).toHaveBeenCalledWith(validBody);
  });

  it("responds 409 when the reference belongs to another image", async () => {
    const image = target();
    image.update.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );
    Image.findByPk.mockResolvedValue(image);

    const response = await put("1", validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Image already exists" });
  });

  it("responds 404 when the image does not exist", async () => {
    Image.findByPk.mockResolvedValue(null);

    const response = await put("999", validBody);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Image not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await put(id, validBody);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors: { id: "Invalid image id" } });
      expect(Image.findByPk).not.toHaveBeenCalled();
    },
  );

  it.each([
    {},
    { url: validBody.url },
    { url: validBody.url, reference: validBody.reference },
  ])("responds 400 when fields are missing in %p", async (body) => {
    const response = await put("1", body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "url, reference and thumbnail are required",
    });
    expect(Image.findByPk).not.toHaveBeenCalled();
  });

  it("responds 422 when a field is invalid", async () => {
    const response = await put("1", { ...validBody, url: "not-a-url" });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { url: "URL inválida" } });
    expect(Image.findByPk).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is missing", async () => {
    const response = await put("1", validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Image.findByPk).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await put("1", validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Image.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await put("1", validBody);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const image = target();
    image.update.mockRejectedValue(new Error("database exploded"));
    Image.findByPk.mockResolvedValue(image);

    const response = await put("1", validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
