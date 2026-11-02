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
  put,
  target,
  tokenFor,
  validBody,
} = require("./update.test-helpers");

beforeEach(() => {
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

describe("PUT /products/:id", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update the product and answers 202",
    async (role) => {
      const product = target();
      Product.findByPk.mockResolvedValue(product);

      const response = await put("1", validBody, tokenFor(role));

      expect(response.status).toBe(202);
      expect(response.body).toEqual({ id: 1, ...validBody });
      expect(product.update).toHaveBeenCalledWith(validBody);
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("trims the text fields before persisting them", async () => {
    const product = target();
    Product.findByPk.mockResolvedValue(product);

    const response = await put("1", {
      ...validBody,
      name: "  Ibuprofeno 800 mg  ",
      reference: "  IBU-800  ",
    });

    expect(response.status).toBe(202);
    expect(product.update).toHaveBeenCalledWith(validBody);
  });

  it("drops unknown and audit fields", async () => {
    const product = target();
    Product.findByPk.mockResolvedValue(product);

    const response = await put("1", {
      ...validBody,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(202);
    expect(product.update).toHaveBeenCalledWith(validBody);
  });

  it("responds 409 when the reference belongs to another product", async () => {
    const product = target();
    product.update.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );
    Product.findByPk.mockResolvedValue(product);

    const response = await put("1", validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Product already exists" });
  });

  it("responds 422 when the category does not exist", async () => {
    Product.findByPk.mockResolvedValue(target());
    Category.findByPk.mockResolvedValue(null);

    const response = await put("1", validBody);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { category_id: "Invalid category id" },
    });
  });

  it("responds 422 when the image does not exist", async () => {
    Product.findByPk.mockResolvedValue(target());
    Image.findByPk.mockResolvedValue(null);

    const response = await put("1", validBody);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { image_id: "Invalid image id" },
    });
  });

  it("responds 422 when the tax does not exist", async () => {
    Product.findByPk.mockResolvedValue(target());
    Tax.findByPk.mockResolvedValue(null);

    const response = await put("1", validBody);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { tax_id: "Invalid tax id" },
    });
  });

  it("allows changing the tax of an existing product", async () => {
    const product = target();
    Product.findByPk.mockResolvedValue(product);

    const response = await put("1", { ...validBody, tax_id: 9 });

    expect(response.status).toBe(202);
    expect(response.body.tax_id).toBe(9);
    expect(product.update).toHaveBeenCalledWith({ ...validBody, tax_id: 9 });
  });

  it("maps a race-condition foreign key error to 422", async () => {
    const product = target();
    product.update.mockRejectedValue(
      new ForeignKeyConstraintError({
        message: "foreign key",
        fields: ["image_id"],
      }),
    );
    Product.findByPk.mockResolvedValue(product);

    const response = await put("1", validBody);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { image_id: "Invalid image id" },
    });
  });

  it("responds 404 when the product does not exist", async () => {
    Product.findByPk.mockResolvedValue(null);

    const response = await put("999", validBody);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Product not found" });
    expect(Category.findByPk).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await put(id, validBody);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid product id" },
      });
      expect(Product.findByPk).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{}, "image or image_id is required"],
    [{ ...validBody, image_id: null }, "image or image_id is required"],
    [
      { ...validBody, name: undefined },
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
      const response = await put("1", body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message });
      expect(Product.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 422 when a field is invalid", async () => {
    const response = await put("1", {
      ...validBody,
      reference: "a".repeat(101),
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { reference: "Referencia inválida" },
    });
    expect(Product.findByPk).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is missing", async () => {
    const response = await put("1", validBody, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await put("1", validBody, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Product.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await put("1", validBody);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const product = target();
    product.update.mockRejectedValue(new Error("database exploded"));
    Product.findByPk.mockResolvedValue(product);

    const response = await put("1", validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
