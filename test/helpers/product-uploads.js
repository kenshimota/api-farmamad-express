const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const request = require("supertest");
const sharp = require("sharp");

const PUBLIC_BASE_URL = "http://localhost:3001";
const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

let uploadRoot = null;

/**
 * Points UPLOAD_DIR and PUBLIC_BASE_URL to a throwaway folder. Must run before
 * the app is required so express.static mounts the temporary directory.
 * @returns {string} Absolute upload root.
 */
function configureUploadEnvironment() {
  uploadRoot = path.join(
    os.tmpdir(),
    `farmamad-hu37-${process.pid}-${Math.random().toString(16).slice(2)}`,
  );
  process.env.UPLOAD_DIR = uploadRoot;
  process.env.PUBLIC_BASE_URL = PUBLIC_BASE_URL;

  return uploadRoot;
}

/**
 * @returns {string} Folder where the product files are stored.
 */
function getProductsDir() {
  return path.join(uploadRoot, "products");
}

/**
 * @returns {string} Absolute upload root created by the configuration.
 */
function getUploadRoot() {
  return uploadRoot;
}

/**
 * Builds a small in-memory PNG.
 * @param {number} [width] - Image width.
 * @param {number} [height] - Image height.
 * @returns {Promise<Buffer>} PNG buffer.
 */
function pngBuffer(width = 640, height = 480) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 130, b: 210 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Builds the multipart text fields for a product image request.
 * @param {number} categoryId - Category id.
 * @param {object} [overrides] - Field overrides.
 * @returns {object} Text fields.
 */
function imageFields(categoryId, overrides = {}) {
  return {
    name: "Ibuprofeno 400 mg",
    description: "Analgésico y antiinflamatorio",
    reference: "IBU-400",
    category_id: categoryId,
    ...overrides,
  };
}

/**
 * Sends a multipart POST /products request.
 * @param {import("express").Express} app - Express app.
 * @param {string} token - Bearer token.
 * @param {object} fields - Text fields.
 * @param {Buffer|null} [buffer] - File content.
 * @param {object} [options] - Request options.
 * @param {string} [options.field] - File field name.
 * @param {boolean} [options.attach] - Attach the file or not.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function postImage(
  app,
  token,
  fields,
  buffer = pngBuffer(),
  { field = "image", attach = true } = {},
) {
  const req = request(app)
    .post("/products")
    .set("Authorization", `Bearer ${token}`);

  Object.entries(fields).forEach(([name, value]) =>
    req.field(name, `${value}`),
  );

  if (!attach) {
    return req;
  }

  return Promise.resolve(buffer).then((content) =>
    req.attach(field, content, "client-name.png"),
  );
}

/**
 * Sends a multipart PUT /products/:id request.
 * @param {import("express").Express} app - Express app.
 * @param {string} token - Bearer token.
 * @param {number} id - Product id.
 * @param {object} fields - Text fields.
 * @param {Buffer} buffer - File content.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function putImage(app, token, id, fields, buffer) {
  const req = request(app)
    .put(`/products/${id}`)
    .set("Authorization", `Bearer ${token}`);

  Object.entries(fields).forEach(([name, value]) =>
    req.field(name, `${value}`),
  );

  return req.attach("image", buffer, "client-name.png");
}

/**
 * Resolves the on-disk paths of a stored image row.
 * @param {object} image - Stored image instance.
 * @returns {{ uuid: string, original: string, thumbnail: string }} Paths.
 */
function storedFiles(image) {
  const uuid = new RegExp(`^product-(${UUID_PATTERN})$`).exec(
    image.reference,
  )[1];

  return {
    uuid,
    original: path.join(
      getProductsDir(),
      `${uuid}${path.extname(image.pathname)}`,
    ),
    thumbnail: path.join(getProductsDir(), `${uuid}-thumb.webp`),
  };
}

/**
 * Empties the products upload folder.
 * @returns {Promise<void>} Resolves once the folder is gone.
 */
function resetUploads() {
  return fs.rm(getProductsDir(), { recursive: true, force: true });
}

/**
 * Removes the whole temporary upload root.
 * @returns {Promise<void>} Resolves once the folder is gone.
 */
function removeUploads() {
  return fs.rm(uploadRoot, { recursive: true, force: true });
}

module.exports = {
  PUBLIC_BASE_URL,
  UUID_PATTERN,
  configureUploadEnvironment,
  getProductsDir,
  getUploadRoot,
  imageFields,
  pngBuffer,
  postImage,
  putImage,
  removeUploads,
  resetUploads,
  storedFiles,
};
