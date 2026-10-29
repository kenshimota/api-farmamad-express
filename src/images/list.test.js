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
const Image = require("../models/image");
const User = require("../models/user");
const listRouter = require("./list");

const app = express();
app.use(express.json());
app.use("/images", listRouter);

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const ALL_ROLES = [
  "admin",
  "seller",
  "dispatcher",
  "manager_warehouse",
  "support",
  "customer",
];
const storedImages = [
  {
    id: 1,
    url: "https://cdn.farmamad.com/products/ibuprofeno.png",
    pathname: "/uploads/products/ibuprofeno.png",
    reference: "ibuprofeno-400",
    thumbnail: "https://cdn.farmamad.com/products/ibuprofeno-thumb.png",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  },
  {
    id: 2,
    url: "https://cdn.farmamad.com/products/paracetamol.png",
    pathname: null,
    reference: "paracetamol-500",
    thumbnail: "https://cdn.farmamad.com/products/paracetamol-thumb.png",
    createdAt: new Date("2026-09-02T00:00:00.000Z"),
    updatedAt: new Date("2026-09-02T00:00:00.000Z"),
  },
];
const publicImage = ({ id, url, pathname, reference, thumbnail }) => ({
  id,
  url,
  pathname,
  reference,
  thumbnail,
});

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
 * Sends a GET request with an optional bearer token.
 * @param {string} path - Request path under /images.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function get(path, token = tokenFor()) {
  const req = request(app).get(`/images${path}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  Image.create.mockReset();
  Image.findAll.mockReset();
  Image.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /images", () => {
  it.each(ALL_ROLES)(
    "returns the public images for an authenticated %s",
    async (role) => {
      Image.findAll.mockResolvedValue(storedImages);

      const response = await get("/", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(storedImages.map(publicImage));
      expect(response.body[0]).not.toHaveProperty("createdAt");
      expect(response.body[0]).not.toHaveProperty("updatedAt");
      expect(Image.findAll).toHaveBeenCalledWith({ order: [["id", "ASC"]] });
    },
  );

  it("returns an empty array when there are no images", async () => {
    Image.findAll.mockResolvedValue([]);

    const response = await get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responds 401 without a token", async () => {
    const response = await get("/", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Image.findAll).not.toHaveBeenCalled();
  });

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get("/");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(Image.findAll).not.toHaveBeenCalled();
  });
});

describe("GET /images/:id", () => {
  it.each(ALL_ROLES)(
    "returns one public image for an authenticated %s",
    async (role) => {
      Image.findByPk.mockResolvedValue(storedImages[0]);

      const response = await get("/1", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(publicImage(storedImages[0]));
      expect(Image.findByPk).toHaveBeenCalledWith(1);
    },
  );

  it("responds 404 when the image does not exist", async () => {
    Image.findByPk.mockResolvedValue(null);

    const response = await get("/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Image not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await get(`/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors: { id: "Invalid image id" } });
      expect(Image.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 without a token", async () => {
    const response = await get("/1", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
