process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { authenticate, getJwtSecret } = require("./middleware");

const app = express();
app.use(express.json());
app.get("/protected", authenticate, (req, res) => {
  res.json({ sub: req.user.sub, role: req.user.role });
});
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Internal server error" });
});

const SECRET = "test-secret";

/**
 * Signs a JWT for the given payload and options.
 * @param {object} [payload] - Token payload.
 * @param {object} [options] - jsonwebtoken sign options.
 * @returns {string} Signed JWT.
 */
function tokenFor(payload = { sub: 1, role: "admin" }, options) {
  return jwt.sign(payload, SECRET, { expiresIn: "1h", ...options });
}

/**
 * Sends a request to the protected route.
 * @param {string} [authorization] - Raw Authorization header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function protectedRequest(authorization) {
  const req = request(app).get("/protected");

  return authorization ? req.set("Authorization", authorization) : req;
}

beforeEach(() => {
  User.findByPk.mockReset();
});

describe("authenticate", () => {
  it("continues and attaches the payload for an existing active user", async () => {
    User.findByPk.mockResolvedValue({ id: 1, isBlocked: false });

    const response = await protectedRequest(`Bearer ${tokenFor()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ sub: 1, role: "admin" });
    expect(User.findByPk).toHaveBeenCalledWith(1);
  });

  it("responds 401 without an authorization header", async () => {
    const response = await protectedRequest();

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it.each([
    ["a non bearer scheme", "Basic abc"],
    ["a bearer token without value", "Bearer"],
    ["an empty header", ""],
  ])("responds 401 with %s", async (_case, header) => {
    const response = await protectedRequest(header);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await protectedRequest("Bearer not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("responds 401 when the token uses a different algorithm", async () => {
    const hs384 = jwt.sign({ sub: 1 }, SECRET, {
      algorithm: "HS384",
      expiresIn: "1h",
    });

    const response = await protectedRequest(`Bearer ${hs384}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is expired", async () => {
    const expired = tokenFor({ sub: 1 }, { expiresIn: "-1s" });

    const response = await protectedRequest(`Bearer ${expired}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("responds 401 when the user no longer exists", async () => {
    User.findByPk.mockResolvedValue(null);

    const response = await protectedRequest(`Bearer ${tokenFor()}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("responds 403 when the user is blocked", async () => {
    User.findByPk.mockResolvedValue({ id: 1, isBlocked: true });

    const response = await protectedRequest(`Bearer ${tokenFor()}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards database errors to the error handler", async () => {
    User.findByPk.mockRejectedValue(new Error("database down"));

    const response = await protectedRequest(`Bearer ${tokenFor()}`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Internal server error" });
  });
});

describe("getJwtSecret", () => {
  it("requires JWT_SECRET to be defined", () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    try {
      expect(() => getJwtSecret()).toThrow("JWT_SECRET is required");
    } finally {
      process.env.JWT_SECRET = original;
    }
  });
});
