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
const { ForeignKeyConstraintError } = require("sequelize");
const Image = require("../models/image");
const User = require("../models/user");
const removeRouter = require("./remove");

const app = express();
app.use(express.json());
app.use("/images", removeRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };

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
 * Builds a stored image double with a working destroy method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The image double.
 */
function target(overrides = {}) {
  return {
    id: 1,
    reference: "ibuprofeno-400",
    destroy: jest.fn().mockResolvedValue(),
    ...overrides,
  };
}

/**
 * Sends a DELETE /images/:id request.
 * @param {string} id - Route parameter.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function remove(id, token = tokenFor()) {
  const req = request(app).delete(`/images/${id}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  Image.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("DELETE /images/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to delete an image and answers 204",
    async (role) => {
      const image = target();
      Image.findByPk.mockResolvedValue(image);

      const response = await remove("1", tokenFor(role));

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      expect(image.destroy).toHaveBeenCalledTimes(1);
    },
  );

  it("responds 409 when a product references the image", async () => {
    const image = target();
    image.destroy.mockRejectedValue(
      new ForeignKeyConstraintError({ message: "foreign key" }),
    );
    Image.findByPk.mockResolvedValue(image);

    const response = await remove("1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Image is in use" });
  });

  it("responds 404 when the image does not exist", async () => {
    Image.findByPk.mockResolvedValue(null);

    const response = await remove("999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Image not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await remove(id);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors: { id: "Invalid image id" } });
      expect(Image.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 when the token is missing", async () => {
    const response = await remove("1", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Image.findByPk).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await remove("1", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Image.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await remove("1");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const image = target();
    image.destroy.mockRejectedValue(new Error("database exploded"));
    Image.findByPk.mockResolvedValue(image);

    const response = await remove("1");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
