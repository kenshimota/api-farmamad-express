const express = require("express");
const request = require("supertest");
const {
  MAX_UPLOAD_BYTES,
  requireImageSource,
  uploadSingleImage,
} = require("./upload");

/**
 * Builds an Express app that exposes the upload middleware and echoes the
 * parsed request so the tests can inspect it.
 * @returns {import("express").Express} Test app.
 */
function buildApp() {
  const app = express();

  app.use(express.json());
  app.post("/upload", uploadSingleImage, (req, res) =>
    res.json({
      file: req.file
        ? {
            fieldname: req.file.fieldname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            buffer: req.file.buffer.length,
          }
        : null,
      body: req.body,
    }),
  );
  app.use((error, req, res, next) => {
    res.status(500).json({ message: "Server error" });
  });

  return app;
}

/**
 * Builds a minimal Express response double.
 * @returns {object} Response double.
 */
function response() {
  return {
    statusCode: 200,
    body: undefined,
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(body) {
      this.body = body;
      return this;
    }),
  };
}

describe("uploadSingleImage", () => {
  const app = buildApp();

  it("passes plain JSON requests through without a file", async () => {
    const res = await request(app).post("/upload").send({ name: "Product" });

    expect(res.status).toBe(200);
    expect(res.body.file).toBeNull();
    expect(res.body.body).toEqual({ name: "Product" });
  });

  it("keeps the uploaded image in memory and parses the other fields", async () => {
    const res = await request(app)
      .post("/upload")
      .field("name", "Ibuprofeno")
      .field("category_id", "1")
      .attach("image", Buffer.from("file-content"), "photo.png");

    expect(res.status).toBe(200);
    expect(res.body.file).toEqual({
      fieldname: "image",
      size: Buffer.byteLength("file-content"),
      mimetype: "image/png",
      buffer: Buffer.byteLength("file-content"),
    });
    expect(res.body.body).toEqual({ name: "Ibuprofeno", category_id: "1" });
  });

  it("answers 413 when the file exceeds 5 MB", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("image", Buffer.alloc(MAX_UPLOAD_BYTES + 1), "large.png");

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: "Image too large" });
  });

  it("answers 400 when the file arrives in an unexpected field", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("content"), "photo.png");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Unexpected field" });
  });

  it.each(["images", "photo", "file"])(
    "answers 400 for the unexpected field %s",
    async (field) => {
      const res = await request(app)
        .post("/upload")
        .attach(field, Buffer.from("content"), "photo.png");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Unexpected field" });
    },
  );
});

describe("requireImageSource", () => {
  it("answers 400 when neither image nor image_id is present", () => {
    const res = response();
    const next = jest.fn();

    requireImageSource({ body: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ message: "image or image_id is required" });
    expect(next).not.toHaveBeenCalled();
  });

  it.each([[""], [null], [undefined]])(
    "treats an empty image_id (%p) as missing",
    (image_id) => {
      const res = response();
      const next = jest.fn();

      requireImageSource({ body: { image_id } }, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toEqual({ message: "image or image_id is required" });
      expect(next).not.toHaveBeenCalled();
    },
  );

  it("answers 422 when image and image_id are combined", () => {
    const res = response();
    const next = jest.fn();

    requireImageSource(
      { body: { image_id: 3 }, file: { buffer: Buffer.from("x") } },
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({
      errors: { image_id: "image_id cannot be combined with image" },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("continues when only an image is present", () => {
    const res = response();
    const next = jest.fn();

    requireImageSource(
      { body: {}, file: { buffer: Buffer.from("x") } },
      res,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("continues when only image_id is present", () => {
    const res = response();
    const next = jest.fn();

    requireImageSource({ body: { image_id: 3 } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
