process.env.JWT_SECRET = "test-secret";

jest.mock("../models/warehouse", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const Warehouse = require("../models/warehouse");
const User = require("../models/user");
const listRouter = require("./list");

const app = express();
app.use(express.json());
app.use("/warehouses", listRouter);

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const storedWarehouses = [
  {
    id: 1,
    name: "Bodega Central",
    observations: "Horario de 8 a 18",
    address: "Av. Monseñor Rivero 123",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  },
  {
    id: 2,
    name: "Bodega Norte",
    observations: null,
    address: "Calle 2 #45",
    createdAt: new Date("2026-09-02T00:00:00.000Z"),
    updatedAt: new Date("2026-09-02T00:00:00.000Z"),
  },
];

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
 * @param {string} path - Request path under /warehouses.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function get(path, token = tokenFor()) {
  const req = request(app).get(`/warehouses${path}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  Warehouse.create.mockReset();
  Warehouse.findAll.mockReset();
  Warehouse.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /warehouses", () => {
  it.each(["admin", "dispatcher", "manager_warehouse"])(
    "returns the public warehouses for a %s",
    async (role) => {
      Warehouse.findAll.mockResolvedValue(storedWarehouses);

      const response = await get("/", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          name: "Bodega Central",
          observations: "Horario de 8 a 18",
          address: "Av. Monseñor Rivero 123",
        },
        {
          id: 2,
          name: "Bodega Norte",
          observations: null,
          address: "Calle 2 #45",
        },
      ]);
      expect(response.body[0]).not.toHaveProperty("createdAt");
      expect(response.body[0]).not.toHaveProperty("updatedAt");
      expect(Warehouse.findAll).toHaveBeenCalledWith({
        order: [["id", "ASC"]],
      });
    },
  );

  it("returns an empty array when there are no warehouses", async () => {
    Warehouse.findAll.mockResolvedValue([]);

    const response = await get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("filters with a trimmed partial search across the text fields", async () => {
    Warehouse.findAll.mockResolvedValue([storedWarehouses[0]]);

    const response = await get("/?search=%20central%20");

    expect(response.status).toBe(200);
    expect(Warehouse.findAll).toHaveBeenCalledWith({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: "%central%" } },
          { observations: { [Op.iLike]: "%central%" } },
          { address: { [Op.iLike]: "%central%" } },
        ],
      },
      order: [["id", "ASC"]],
    });
  });

  it.each(["", "%20%20%20"])(
    "returns the full list when search is blank (%p)",
    async (search) => {
      Warehouse.findAll.mockResolvedValue(storedWarehouses);

      const response = await get(`/?search=${search}`);

      expect(response.status).toBe(200);
      expect(Warehouse.findAll).toHaveBeenCalledWith({
        order: [["id", "ASC"]],
      });
    },
  );

  it("does not answer 500 when search is not a string", async () => {
    Warehouse.findAll.mockResolvedValue(storedWarehouses);

    const response = await get("/?search[a]=central");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(Warehouse.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
    });
  });

  it("responds 401 without a token", async () => {
    const response = await get("/", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Warehouse.findAll).not.toHaveBeenCalled();
  });

  it.each(["seller", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await get("/", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Warehouse.findAll).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get("/");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(Warehouse.findAll).not.toHaveBeenCalled();
  });
});

describe("GET /warehouses/:id", () => {
  it.each(["admin", "dispatcher", "manager_warehouse"])(
    "returns one public warehouse for a %s",
    async (role) => {
      Warehouse.findByPk.mockResolvedValue(storedWarehouses[0]);

      const response = await get("/1", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        name: "Bodega Central",
        observations: "Horario de 8 a 18",
        address: "Av. Monseñor Rivero 123",
      });
      expect(Warehouse.findByPk).toHaveBeenCalledWith(1);
    },
  );

  it("responds 404 when the warehouse does not exist", async () => {
    Warehouse.findByPk.mockResolvedValue(null);

    const response = await get("/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Warehouse not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await get(`/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid warehouse id" },
      });
      expect(Warehouse.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 without a token", async () => {
    const response = await get("/1", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["seller", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await get("/1", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Warehouse.findByPk).not.toHaveBeenCalled();
    },
  );
});
