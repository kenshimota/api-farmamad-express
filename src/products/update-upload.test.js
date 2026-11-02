process.env.JWT_SECRET = "test-secret";

jest.mock("../models/product", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/category", () => ({ findByPk: jest.fn() }));
jest.mock("../models/image", () => ({
  create: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/tax", () => ({ findByPk: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("../database", () => ({
  transaction: jest.fn((work) => work("transaction")),
}));
jest.mock("./image-service", () => ({
  processUploadedImage: jest.fn(),
  removeFiles: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const Product = require("../models/product");
const Category = require("../models/category");
const Image = require("../models/image");
const Tax = require("../models/tax");
const User = require("../models/user");
const {
  InvalidImageDimensionsError,
  InvalidImageError,
} = require("./image-errors");
const { processUploadedImage, removeFiles } = require("./image-service");
const updateRouter = require("./update");

const app = express();
app.use(express.json());
app.use("/products", updateRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const fields = {
  name: "Ibuprofeno 800 mg",
  description: "Analgésico y antiinflamatorio",
  reference: "IBU-800",
  category_id: 1,
  tax_id: 3,
};
const generatedImage = {
  image: {
    reference: "product-22222222-2222-2222-2222-222222222222",
    pathname: "/uploads/products/22222222-2222-2222-2222-222222222222.png",
    url: "http://localhost:3001/uploads/products/22222222-2222-2222-2222-222222222222.png",
    thumbnail:
      "http://localhost:3001/uploads/products/22222222-2222-2222-2222-222222222222-thumb.webp",
  },
  files: ["/tmp/original.png", "/tmp/thumbnail.webp"],
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
 * Builds a stored product double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The product double.
 */
function target(overrides = {}) {
  return {
    id: 1,
    name: "Ibuprofeno 400 mg",
    description: "Analgésico y antiinflamatorio",
    reference: "IBU-400",
    category_id: 1,
    image_id: 2,
    tax_id: 3,
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

/**
 * Sends a multipart PUT /products/:id request.
 * @param {string} id - Route parameter.
 * @param {object} body - Text fields.
 * @param {object} [options] - Request options.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function putMultipart(
  id,
  body,
  {
    token = tokenFor(),
    field = "image",
    buffer = Buffer.from("image"),
    attach = true,
  } = {},
) {
  const req = request(app)
    .put(`/products/${id}`)
    .set("Authorization", `Bearer ${token}`);

  Object.entries(body).forEach(([name, value]) => req.field(name, `${value}`));

  return attach ? req.attach(field, buffer, "photo.png") : req;
}

beforeEach(() => {
  Product.findByPk.mockReset();
  Category.findByPk.mockReset();
  Image.create.mockReset();
  Image.findByPk.mockReset();
  Tax.findByPk.mockReset();
  User.findByPk.mockReset();
  processUploadedImage.mockReset();
  removeFiles.mockReset();
  Category.findByPk.mockResolvedValue({ id: 1 });
  Image.findByPk.mockResolvedValue({ id: 2 });
  Tax.findByPk.mockResolvedValue({ id: 3 });
  User.findByPk.mockResolvedValue(AUTH_USER);
  removeFiles.mockResolvedValue();
});

describe("PUT /products/:id with multipart/form-data", () => {
  it("creates a new image row and replaces image_id inside one transaction", async () => {
    const product = target();
    Product.findByPk.mockResolvedValue(product);
    processUploadedImage.mockResolvedValue(generatedImage);
    Image.create.mockResolvedValue({ id: 7, ...generatedImage.image });

    const response = await putMultipart("1", fields);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ id: 1, ...fields, image_id: 7 });
    expect(Image.create).toHaveBeenCalledWith(generatedImage.image, {
      transaction: "transaction",
    });
    expect(product.update).toHaveBeenCalledWith(
      { ...fields, image_id: 7 },
      { transaction: "transaction" },
    );
    expect(Image.findByPk).not.toHaveBeenCalled();
  });

  it("converts numeric multipart strings before validating", async () => {
    const product = target();
    Product.findByPk.mockResolvedValue(product);
    processUploadedImage.mockResolvedValue(generatedImage);
    Image.create.mockResolvedValue({ id: 7, ...generatedImage.image });

    const response = await putMultipart("1", { ...fields, category_id: "1" });

    expect(response.status).toBe(202);
    expect(product.update).toHaveBeenCalledWith(
      { ...fields, image_id: 7 },
      { transaction: "transaction" },
    );
  });

  it("responds 422 when image and image_id are combined", async () => {
    const response = await putMultipart("1", { ...fields, image_id: 2 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { image_id: "image_id cannot be combined with image" },
    });
    expect(processUploadedImage).not.toHaveBeenCalled();
    expect(Product.findByPk).not.toHaveBeenCalled();
  });

  it("responds 422 when the file is not a valid image", async () => {
    Product.findByPk.mockResolvedValue(target());
    processUploadedImage.mockRejectedValue(new InvalidImageError());

    const response = await putMultipart("1", fields);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { image: "Invalid image" } });
    expect(Image.create).not.toHaveBeenCalled();
  });

  it("responds 422 when the image dimensions are invalid", async () => {
    Product.findByPk.mockResolvedValue(target());
    processUploadedImage.mockRejectedValue(new InvalidImageDimensionsError());

    const response = await putMultipart("1", fields);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { image: "Invalid image dimensions" },
    });
    expect(Image.create).not.toHaveBeenCalled();
  });

  it("removes the written files when the update fails", async () => {
    const product = target();
    product.update.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );
    Product.findByPk.mockResolvedValue(product);
    processUploadedImage.mockResolvedValue(generatedImage);
    Image.create.mockResolvedValue({ id: 7, ...generatedImage.image });

    const response = await putMultipart("1", fields);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Product already exists" });
    expect(removeFiles).toHaveBeenCalledWith(generatedImage.files);
  });

  it("answers 400 when neither image nor image_id is present", async () => {
    const response = await putMultipart("1", fields, { attach: false });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "image or image_id is required",
    });
  });

  it("answers 400 for a file in an unexpected field", async () => {
    const response = await putMultipart("1", fields, { field: "file" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Unexpected field" });
  });

  it("answers 404 for an unknown product before storing the new image", async () => {
    Product.findByPk.mockResolvedValue(null);
    processUploadedImage.mockResolvedValue(generatedImage);

    const response = await putMultipart("999", fields);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Product not found" });
    expect(Image.create).not.toHaveBeenCalled();
  });
});
