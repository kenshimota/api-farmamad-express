process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("../models/role", () => ({ findOne: jest.fn() }));

jest.mock("../database", () => ({ transaction: jest.fn() }));

const express = require("express");
const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const User = require("../models/user");
const Role = require("../models/role");
const authRouter = require("./index");
const { getJwtSecret } = require("./middleware");
const { loginSchema, formatLoginErrors } = require("./validators");

const app = express();
app.use(express.json());
app.use("/auth", authRouter);

const SECRET = "test-secret";
const PASSWORD = "secret123";
const passwordHash = bcrypt.hashSync(PASSWORD, 10);
const user = {
  id: 1,
  username: "juan",
  email: "juan@example.com",
  name: "Juan",
  password: passwordHash,
  role: { name: "customer" },
};
const publicUser = {
  id: 1,
  username: "juan",
  email: "juan@example.com",
  name: "Juan",
  role: "customer",
};

const login = (body) => request(app).post("/auth/login").send(body);
const signToken = (payload, options) => jwt.sign(payload, SECRET, options);

beforeEach(() => {
  User.findOne.mockReset();
  User.findByPk.mockReset();
});

describe("POST /auth/login", () => {
  it("logs in with a valid email and returns a signed JWT", async () => {
    User.findOne.mockResolvedValue(user);

    const response = await login({
      identifier: "juan@example.com",
      password: PASSWORD,
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual(publicUser);
    expect(response.body.user).not.toHaveProperty("password");
    expect(User.findOne).toHaveBeenCalledWith({
      where: {
        [Op.or]: [
          { email: "juan@example.com" },
          { username: "juan@example.com" },
        ],
      },
      include: { model: Role, as: "role" },
    });

    const decoded = jwt.verify(response.body.token, SECRET, {
      algorithms: ["HS256"],
    });
    expect(decoded.sub).toBe(1);
    expect(decoded.username).toBe("juan");
    expect(decoded.email).toBe("juan@example.com");
    expect(decoded.role).toBe("customer");
    expect(decoded.iat).toEqual(expect.any(Number));
    expect(decoded.exp).toEqual(expect.any(Number));
    expect(decoded.exp - decoded.iat).toBe(3600);
  });

  it("logs in with a valid username", async () => {
    User.findOne.mockResolvedValue(user);

    const response = await login({ identifier: "juan", password: PASSWORD });

    expect(response.status).toBe(200);
    expect(User.findOne).toHaveBeenCalledWith({
      where: { [Op.or]: [{ email: "juan" }, { username: "juan" }] },
      include: { model: Role, as: "role" },
    });
    const decoded = jwt.verify(response.body.token, SECRET, {
      algorithms: ["HS256"],
    });
    expect(decoded.username).toBe("juan");
  });

  it("honors the JWT_EXPIRES_IN environment variable", async () => {
    User.findOne.mockResolvedValue(user);
    process.env.JWT_EXPIRES_IN = "2h";

    try {
      const response = await login({ identifier: "juan", password: PASSWORD });
      const decoded = jwt.verify(response.body.token, SECRET, {
        algorithms: ["HS256"],
      });
      expect(decoded.exp - decoded.iat).toBe(7200);
    } finally {
      delete process.env.JWT_EXPIRES_IN;
    }
  });

  it("responds 401 when the user does not exist", async () => {
    User.findOne.mockResolvedValue(null);

    const response = await login({ identifier: "nobody", password: PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Invalid credentials" });
  });

  it("responds 401 when the password is incorrect", async () => {
    User.findOne.mockResolvedValue(user);

    const response = await login({
      identifier: "juan",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Invalid credentials" });
  });

  it("responds 400 when the request has no body", async () => {
    const response = await request(app).post("/auth/login");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "identifier and password are required",
    });
  });

  it.each([
    ["both fields are missing", {}],
    ["the identifier is missing", { password: PASSWORD }],
    ["the password is missing", { identifier: "juan" }],
    ["the identifier is empty", { identifier: "", password: PASSWORD }],
  ])("responds 400 when %s", async (_case, body) => {
    const response = await login(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "identifier and password are required",
    });
  });

  it("responds 422 with field errors when the email is invalid", async () => {
    const response = await login({ identifier: "invalid@", password: "short" });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: {
        email: "Invalid email",
        password: "Password must be at least 8 characters long",
      },
    });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it("responds 422 when the password is too short", async () => {
    const response = await login({ identifier: "juan", password: "short" });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { password: "Password must be at least 8 characters long" },
    });
    expect(User.findOne).not.toHaveBeenCalled();
  });
});

describe("GET /auth/me", () => {
  const token = signToken(
    { sub: 1, username: "juan", email: "juan@example.com", role: "customer" },
    { expiresIn: "1h" },
  );

  it("returns the authenticated user with the role and without the password", async () => {
    User.findByPk.mockResolvedValue(user);

    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(publicUser);
    expect(response.body).not.toHaveProperty("password");
    expect(response.body).not.toHaveProperty("roleId");
    expect(User.findByPk).toHaveBeenCalledWith(1, {
      include: { model: Role, as: "role" },
    });
  });

  it("responds 401 without an authorization header", async () => {
    const response = await request(app).get("/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", "Bearer not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("responds 401 when the token uses a different algorithm", async () => {
    User.findByPk.mockResolvedValue(user);
    const hs384 = signToken(
      { sub: 1 },
      { algorithm: "HS384", expiresIn: "1h" },
    );

    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${hs384}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is expired", async () => {
    const expired = signToken({ sub: 1 }, { expiresIn: "-1s" });

    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${expired}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("responds 401 when the user no longer exists", async () => {
    User.findByPk.mockResolvedValue(null);

    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});

describe("loginSchema", () => {
  it("accepts a password with exactly 8 characters", async () => {
    await expect(
      loginSchema.validate({ identifier: "juan", password: "12345678" }),
    ).resolves.toBeDefined();
  });

  it("rejects a password with 7 characters", async () => {
    await expect(
      loginSchema.validate({ identifier: "juan", password: "1234567" }),
    ).rejects.toThrow("Password must be at least 8 characters long");
  });
});

describe("formatLoginErrors", () => {
  it("falls back to the error itself when there are no inner errors", () => {
    const error = { path: "identifier", message: "Invalid email or username" };

    expect(formatLoginErrors(error, "juan")).toEqual({
      identifier: "Invalid email or username",
    });
  });
});

describe("JWT configuration", () => {
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
