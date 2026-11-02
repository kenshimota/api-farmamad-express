process.env.JWT_SECRET = "test-secret";

jest.mock("./repository", () => ({
  priceListRepository: {
    create: jest.fn(),
    list: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    countCustomers: jest.fn(),
  },
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const User = require("../models/user");
const { priceListRepository } = require("./repository");
const priceListsRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/price-lists", priceListsRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const validBody = {
  name: "Mayorista 30",
  description: "Margen del 30 % para mayoristas",
  percentage: 30,
};
const storedList = {
  id: 1,
  name: "Mayorista 30",
  description: "Margen del 30 % para mayoristas",
  percentage: "30.00",
};
const publicList = {
  id: 1,
  name: "Mayorista 30",
  description: "Margen del 30 % para mayoristas",
  percentage: 30,
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
 * Sends a request to the mounted router.
 * @param {string} method - HTTP method in lowercase.
 * @param {string} path - Path under /price-lists.
 * @param {object|null} [body] - Optional JSON body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function send(method, path, body = null, token = tokenFor()) {
  const req = request(app)[method](`/price-lists${path}`);

  if (token) {
    req.set("Authorization", `Bearer ${token}`);
  }

  return body ? req.send(body) : req;
}

beforeEach(() => {
  Object.values(priceListRepository).forEach((mock) => mock.mockReset());
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("POST /price-lists", () => {
  it.each(["admin", "seller"])("allows a %s and answers 201", async (role) => {
    priceListRepository.create.mockResolvedValue(storedList);

    const response = await send("post", "", validBody, tokenFor(role));

    expect(response.status).toBe(201);
    expect(response.body).toEqual(publicList);
    expect(priceListRepository.create).toHaveBeenCalledWith(validBody);
    expect(response.body).not.toHaveProperty("createdAt");
  });

  it("responds 401 without a token", async () => {
    const response = await send("post", "", validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await send("post", "", validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 400 when name or percentage is missing", async () => {
    const response = await send("post", "", { name: "Mayorista" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "name and percentage are required",
    });
  });

  it("responds 422 for invalid fields", async () => {
    const response = await send("post", "", {
      ...validBody,
      name: "   ",
      percentage: 100,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: {
        name: "Nombre inválido",
        percentage: "percentage must be < 100",
      },
    });
  });

  it("responds 409 when the name already exists", async () => {
    priceListRepository.create.mockRejectedValue(new UniqueConstraintError({}));

    const response = await send("post", "", validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Price list already exists" });
  });
});

describe("GET /price-lists", () => {
  it.each(["admin", "seller"])("lists the lists for a %s", async (role) => {
    priceListRepository.list.mockResolvedValue([storedList]);

    const response = await send("get", "", null, tokenFor(role));

    expect(response.status).toBe(200);
    expect(response.body).toEqual([publicList]);
    expect(priceListRepository.list).toHaveBeenCalledTimes(1);
  });

  it("returns an empty array", async () => {
    priceListRepository.list.mockResolvedValue([]);

    const response = await send("get", "");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await send("get", "", null, tokenFor(role));

      expect(response.status).toBe(403);
    },
  );
});

describe("GET /price-lists/:id", () => {
  it("returns one list", async () => {
    priceListRepository.findById.mockResolvedValue(storedList);

    const response = await send("get", "/1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(publicList);
    expect(priceListRepository.findById).toHaveBeenCalledWith(1);
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await send("get", `/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid price list id" },
      });
      expect(priceListRepository.findById).not.toHaveBeenCalled();
    },
  );

  it("responds 404 when the list does not exist", async () => {
    priceListRepository.findById.mockResolvedValue(null);

    const response = await send("get", "/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Price list not found" });
  });
});

describe("PUT /price-lists/:id", () => {
  it("replaces the list and answers 202", async () => {
    const updated = {
      ...storedList,
      name: "Mayorista 35",
      description: "Margen del 35 % para mayoristas",
      percentage: "35.00",
    };
    priceListRepository.findById.mockResolvedValue(storedList);
    priceListRepository.update.mockResolvedValue(updated);

    const response = await send("put", "/1", {
      name: "Mayorista 35",
      description: "Margen del 35 % para mayoristas",
      percentage: 35,
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      id: 1,
      name: "Mayorista 35",
      description: "Margen del 35 % para mayoristas",
      percentage: 35,
    });
    expect(priceListRepository.update).toHaveBeenCalledWith(storedList, {
      name: "Mayorista 35",
      description: "Margen del 35 % para mayoristas",
      percentage: 35,
    });
  });

  it("responds 400 when name or percentage is missing", async () => {
    const response = await send("put", "/1", {
      description: "Solo descripción",
    });

    expect(response.status).toBe(400);
    expect(priceListRepository.findById).not.toHaveBeenCalled();
  });

  it("responds 409 when the new name already exists", async () => {
    priceListRepository.findById.mockResolvedValue(storedList);
    priceListRepository.update.mockRejectedValue(new UniqueConstraintError({}));

    const response = await send("put", "/1", validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Price list already exists" });
  });

  it("responds 422 for an invalid id and 404 for a missing list", async () => {
    const invalid = await send("put", "/abc", validBody);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid price list id" },
    });

    priceListRepository.findById.mockResolvedValue(null);
    const missing = await send("put", "/999", validBody);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Price list not found" });
  });
});
