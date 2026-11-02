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
const { ForeignKeyConstraintError } = require("sequelize");
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
const storedList = {
  id: 1,
  name: "Mayorista 30",
  description: "Margen del 30 % para mayoristas",
  percentage: "30.00",
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
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function send(method, path, token = tokenFor()) {
  const req = request(app)[method](`/price-lists${path}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  Object.values(priceListRepository).forEach((mock) => mock.mockReset());
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("DELETE /price-lists/:id", () => {
  it("deletes an unused list and answers 204", async () => {
    priceListRepository.findById.mockResolvedValue(storedList);
    priceListRepository.countCustomers.mockResolvedValue(0);
    priceListRepository.remove.mockResolvedValue();

    const response = await send("delete", "/1");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(priceListRepository.remove).toHaveBeenCalledWith(storedList);
  });

  it("responds 409 when the list is assigned to a customer", async () => {
    priceListRepository.findById.mockResolvedValue(storedList);
    priceListRepository.countCustomers.mockResolvedValue(2);

    const response = await send("delete", "/1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Price list is in use" });
    expect(priceListRepository.remove).not.toHaveBeenCalled();
  });

  it("also answers 409 when the foreign key rejects the delete", async () => {
    priceListRepository.findById.mockResolvedValue(storedList);
    priceListRepository.countCustomers.mockResolvedValue(0);
    priceListRepository.remove.mockRejectedValue(
      new ForeignKeyConstraintError({}),
    );

    const response = await send("delete", "/1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Price list is in use" });
  });

  it("responds 422 for an invalid id and 404 for a missing list", async () => {
    const invalid = await send("delete", "/abc");
    expect(invalid.status).toBe(422);

    priceListRepository.findById.mockResolvedValue(null);
    const missing = await send("delete", "/999");
    expect(missing.status).toBe(404);
  });
});
