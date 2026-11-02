process.env.JWT_SECRET = "test-secret";

jest.mock("../models/product", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/category", () => ({ findByPk: jest.fn() }));
jest.mock("../models/image", () => ({ findByPk: jest.fn() }));
jest.mock("../models/tax", () => ({ findByPk: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const Product = require("../models/product");
const Category = require("../models/category");
const Image = require("../models/image");
const Tax = require("../models/tax");
const User = require("../models/user");
const {
  AUTH_USER,
  post,
  storedProduct,
  tokenFor,
  validBody,
} = require("./products.test-helpers");

beforeEach(() => {
  Product.create.mockReset();
  Product.findAll.mockReset();
  Product.findByPk.mockReset();
  Category.findByPk.mockReset();
  Image.findByPk.mockReset();
  Tax.findByPk.mockReset();
  User.findByPk.mockReset();
  Category.findByPk.mockResolvedValue({ id: 1 });
  Image.findByPk.mockResolvedValue({ id: 2 });
  Tax.findByPk.mockResolvedValue({ id: 3 });
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("POST /products", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a product and answers 201",
    async (role) => {
      Product.create.mockResolvedValue(storedProduct());

      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: 1, ...validBody });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
      expect(Product.create).toHaveBeenCalledWith(validBody);
    },
  );

  it("trims the text fields before persisting them", async () => {
    Product.create.mockResolvedValue(storedProduct());

    const response = await post({
      ...validBody,
      name: "  Ibuprofeno 400 mg  ",
      description: "  Analgésico y antiinflamatorio  ",
      reference: "  IBU-400  ",
    });

    expect(response.status).toBe(201);
    expect(Product.create).toHaveBeenCalledWith(validBody);
  });

  it("drops unknown and audit fields", async () => {
    Product.create.mockResolvedValue(storedProduct());

    const response = await post({
      ...validBody,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(Product.create).toHaveBeenCalledWith(validBody);
  });

  it("responds 409 when the reference already exists", async () => {
    Product.create.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );

    const response = await post(validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Product already exists" });
  });

  it("responds 422 when the category does not exist", async () => {
    Category.findByPk.mockResolvedValue(null);

    const response = await post(validBody);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { category_id: "Invalid category id" },
    });
    expect(Image.findByPk).not.toHaveBeenCalled();
    expect(Product.create).not.toHaveBeenCalled();
  });

  it("responds 422 when the image does not exist", async () => {
    Image.findByPk.mockResolvedValue(null);

    const response = await post(validBody);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { image_id: "Invalid image id" },
    });
    expect(Product.create).not.toHaveBeenCalled();
  });

  it("responds 422 when the tax does not exist", async () => {
    Tax.findByPk.mockResolvedValue(null);

    const response = await post(validBody);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { tax_id: "Invalid tax id" },
    });
    expect(Product.create).not.toHaveBeenCalled();
  });

  it("maps a race-condition foreign key error to 422", async () => {
    Product.create.mockRejectedValue(
      new ForeignKeyConstraintError({
        message: "foreign key",
        fields: { category_id: 1 },
      }),
    );

    const response = await post(validBody);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { category_id: "Invalid category id" },
    });
  });

  it("maps a tax foreign key error to 422", async () => {
    Product.create.mockRejectedValue(
      new ForeignKeyConstraintError({
        message: "foreign key",
        fields: ["tax_id"],
      }),
    );

    const response = await post(validBody);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { tax_id: "Invalid tax id" },
    });
  });

  it("responds 401 when the token is missing", async () => {
    const response = await post(validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Product.create).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await post(validBody, "not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await post(validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Product.create).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await post(validBody);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it.each([
    [{}, "image or image_id is required"],
    [{ ...validBody, image_id: null }, "image or image_id is required"],
    [
      { ...validBody, name: undefined },
      "name, description, reference, category_id and tax_id are required",
    ],
    [
      { ...validBody, description: "" },
      "name, description, reference, category_id and tax_id are required",
    ],
    [
      { ...validBody, reference: null },
      "name, description, reference, category_id and tax_id are required",
    ],
    [
      { ...validBody, category_id: undefined },
      "name, description, reference, category_id and tax_id are required",
    ],
    [
      { ...validBody, tax_id: undefined },
      "name, description, reference, category_id and tax_id are required",
    ],
  ])(
    "responds 400 when a required field is missing in %p",
    async (body, message) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message });
      expect(Product.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["name is blank", { name: "   " }],
    ["name is too long", { name: "a".repeat(151) }],
    ["description is blank", { description: "   " }],
    ["reference is too long", { reference: "a".repeat(101) }],
    ["category_id is zero", { category_id: 0 }],
    ["image_id is not numeric", { image_id: "abc" }],
    ["tax_id is zero", { tax_id: 0 }],
    ["tax_id is not numeric", { tax_id: "abc" }],
  ])("responds 422 when %s", async (_case, overrides) => {
    const response = await post({ ...validBody, ...overrides });

    expect(response.status).toBe(422);
    expect(response.body.errors).toEqual(expect.any(Object));
    expect(Category.findByPk).not.toHaveBeenCalled();
    expect(Product.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    Product.create.mockRejectedValue(new Error("database exploded"));

    const response = await post(validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
