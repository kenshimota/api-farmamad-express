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
const User = require("../models/user");
const {
  InvalidImageDimensionsError,
  InvalidImageError,
} = require("./image-errors");
const { processUploadedImage, removeFiles } = require("./image-service");
const productsRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/products", productsRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const fields = {
  name: "Ibuprofeno 400 mg",
  description: "Analgésico y antiinflamatorio",
  reference: "IBU-400",
  category_id: 1,
};
const generatedImage = {
  image: {
    reference: "product-11111111-1111-1111-1111-111111111111",
    pathname: "/uploads/products/11111111-1111-1111-1111-111111111111.png",
    url: "http://localhost:3001/uploads/products/11111111-1111-1111-1111-111111111111.png",
    thumbnail:
      "http://localhost:3001/uploads/products/11111111-1111-1111-1111-111111111111-thumb.webp",
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
 * Sends a multipart POST /products request.
 * @param {object} body - Text fields.
 * @param {object} [options] - Request options.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function postMultipart(
  body,
  { token = tokenFor(), field = "image", buffer = Buffer.from("image") } = {},
) {
  const req = request(app)
    .post("/products")
    .set("Authorization", `Bearer ${token}`);

  Object.entries(body).forEach(([name, value]) => req.field(name, `${value}`));

  return req.attach(field, buffer, "photo.png");
}

beforeEach(() => {
  Product.create.mockReset();
  Category.findByPk.mockReset();
  Image.create.mockReset();
  Image.findByPk.mockReset();
  User.findByPk.mockReset();
  processUploadedImage.mockReset();
  removeFiles.mockReset();
  Category.findByPk.mockResolvedValue({ id: 1 });
  Image.findByPk.mockResolvedValue({ id: 2 });
  User.findByPk.mockResolvedValue(AUTH_USER);
  removeFiles.mockResolvedValue();
});

describe("POST /products with multipart/form-data", () => {
  it("creates the image row and the product inside one transaction", async () => {
    processUploadedImage.mockResolvedValue(generatedImage);
    Image.create.mockResolvedValue({ id: 7, ...generatedImage.image });
    Product.create.mockResolvedValue({
      id: 1,
      ...fields,
      image_id: 7,
    });

    const response = await postMultipart(fields);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: 1, ...fields, image_id: 7 });
    expect(Image.create).toHaveBeenCalledWith(generatedImage.image, {
      transaction: "transaction",
    });
    expect(Product.create).toHaveBeenCalledWith(
      { ...fields, image_id: 7 },
      { transaction: "transaction" },
    );
    expect(Image.findByPk).not.toHaveBeenCalled();
  });

  it("converts numeric multipart strings before validating", async () => {
    processUploadedImage.mockResolvedValue(generatedImage);
    Image.create.mockResolvedValue({ id: 7, ...generatedImage.image });
    Product.create.mockResolvedValue({ id: 1, ...fields, image_id: 7 });

    const response = await postMultipart({ ...fields, category_id: "1" });

    expect(response.status).toBe(201);
    expect(Product.create).toHaveBeenCalledWith(
      { ...fields, image_id: 7 },
      { transaction: "transaction" },
    );
  });

  it("responds 422 when image and image_id are combined", async () => {
    const response = await postMultipart({ ...fields, image_id: 2 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { image_id: "image_id cannot be combined with image" },
    });
    expect(processUploadedImage).not.toHaveBeenCalled();
    expect(Image.create).not.toHaveBeenCalled();
  });

  it("responds 400 when neither image nor image_id is present", async () => {
    const req = request(app)
      .post("/products")
      .set("Authorization", `Bearer ${tokenFor()}`);

    Object.entries(fields).forEach(([name, value]) =>
      req.field(name, `${value}`),
    );

    const response = await req;

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "image or image_id is required",
    });
  });

  it("responds 422 when the file is not a valid image", async () => {
    processUploadedImage.mockRejectedValue(new InvalidImageError());

    const response = await postMultipart(fields);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { image: "Invalid image" } });
    expect(Image.create).not.toHaveBeenCalled();
  });

  it("responds 422 when the image dimensions are invalid", async () => {
    processUploadedImage.mockRejectedValue(new InvalidImageDimensionsError());

    const response = await postMultipart(fields);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { image: "Invalid image dimensions" },
    });
    expect(Image.create).not.toHaveBeenCalled();
  });

  it("removes the written files when the product cannot be created", async () => {
    processUploadedImage.mockResolvedValue(generatedImage);
    Image.create.mockResolvedValue({ id: 7, ...generatedImage.image });
    Product.create.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );

    const response = await postMultipart(fields);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Product already exists" });
    expect(removeFiles).toHaveBeenCalledWith(generatedImage.files);
  });

  it("answers 413 through the products middleware for oversized files", async () => {
    const response = await postMultipart(fields, {
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ message: "Image too large" });
    expect(processUploadedImage).not.toHaveBeenCalled();
  });

  it("answers 400 for a file in an unexpected field", async () => {
    const response = await postMultipart(fields, { field: "file" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Unexpected field" });
    expect(processUploadedImage).not.toHaveBeenCalled();
  });

  it("responds 400 when a text field is missing", async () => {
    const response = await postMultipart({ ...fields, name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "name, description, reference and category_id are required",
    });
  });
});
