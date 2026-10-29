process.env.JWT_SECRET = "test-secret";

jest.mock("../models/customer", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const Customer = require("../models/customer");
const User = require("../models/user");
const listRouter = require("./list");

const app = express();
app.use(express.json());
app.use("/customers", listRouter);

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const storedCustomers = [
  {
    id: 1,
    fullName: "Juan Pérez",
    latitude: "-17.7833000",
    longitude: "-63.1821000",
    direction: "Av. Monseñor Rivero 123",
    email: "juan@example.com",
    isRegistered: false,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  },
  {
    id: 2,
    fullName: "Ana Gómez",
    latitude: "-17.7900000",
    longitude: "-63.1900000",
    direction: "Calle 2 #45",
    email: "ana@example.com",
    isRegistered: true,
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
 * @param {string} path - Request path under /customers.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function get(path, token = tokenFor()) {
  const req = request(app).get(`/customers${path}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  Customer.create.mockReset();
  Customer.findAll.mockReset();
  Customer.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /customers", () => {
  it.each(["admin", "seller", "dispatcher"])(
    "returns the public customers for a %s",
    async (role) => {
      Customer.findAll.mockResolvedValue(storedCustomers);

      const response = await get("/", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          fullName: "Juan Pérez",
          latitude: -17.7833,
          longitude: -63.1821,
          direction: "Av. Monseñor Rivero 123",
          email: "juan@example.com",
        },
        {
          id: 2,
          fullName: "Ana Gómez",
          latitude: -17.79,
          longitude: -63.19,
          direction: "Calle 2 #45",
          email: "ana@example.com",
        },
      ]);
      expect(response.body[0]).not.toHaveProperty("isRegistered");
      expect(response.body[0]).not.toHaveProperty("createdAt");
      expect(Customer.findAll).toHaveBeenCalledWith({
        order: [["id", "ASC"]],
      });
    },
  );

  it("returns an empty array when there are no customers", async () => {
    Customer.findAll.mockResolvedValue([]);

    const response = await get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responds 401 without a token", async () => {
    const response = await get("/", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Customer.findAll).not.toHaveBeenCalled();
  });

  it.each(["manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await get("/", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Customer.findAll).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await get("/");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(Customer.findAll).not.toHaveBeenCalled();
  });
});

describe("GET /customers/:id", () => {
  it.each(["admin", "seller", "dispatcher"])(
    "returns one public customer for a %s",
    async (role) => {
      Customer.findByPk.mockResolvedValue(storedCustomers[0]);

      const response = await get("/1", tokenFor(role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        fullName: "Juan Pérez",
        latitude: -17.7833,
        longitude: -63.1821,
        direction: "Av. Monseñor Rivero 123",
        email: "juan@example.com",
      });
      expect(Customer.findByPk).toHaveBeenCalledWith(1);
    },
  );

  it("responds 404 when the customer does not exist", async () => {
    Customer.findByPk.mockResolvedValue(null);

    const response = await get("/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Customer not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await get(`/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid customer id" },
      });
      expect(Customer.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 without a token", async () => {
    const response = await get("/1", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await get("/1", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Customer.findByPk).not.toHaveBeenCalled();
    },
  );
});
