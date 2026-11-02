const path = require("path");
const {
  DEFAULT_PORT,
  getProductsUploadDir,
  getPublicBaseUrl,
  getUploadDir,
} = require("./image-config");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const ORIGINAL_ENV = {
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
  PORT: process.env.PORT,
};

/**
 * Restores an environment variable to its original value.
 * @param {string} name - Variable name.
 * @param {string|undefined} value - Original value.
 * @returns {void}
 */
function restore(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

beforeEach(() => {
  delete process.env.UPLOAD_DIR;
  delete process.env.PUBLIC_BASE_URL;
  delete process.env.PORT;
});

afterAll(() => {
  restore("UPLOAD_DIR", ORIGINAL_ENV.UPLOAD_DIR);
  restore("PUBLIC_BASE_URL", ORIGINAL_ENV.PUBLIC_BASE_URL);
  restore("PORT", ORIGINAL_ENV.PORT);
});

describe("getUploadDir", () => {
  it("defaults to <repo>/uploads", () => {
    expect(getUploadDir()).toBe(path.join(PROJECT_ROOT, "uploads"));
  });

  it("resolves an absolute UPLOAD_DIR from the environment", () => {
    process.env.UPLOAD_DIR = "/tmp/farmamad-uploads";

    expect(getUploadDir()).toBe("/tmp/farmamad-uploads");
  });

  it("resolves a relative UPLOAD_DIR against the working directory", () => {
    process.env.UPLOAD_DIR = "tmp/uploads";

    expect(getUploadDir()).toBe(path.resolve("tmp/uploads"));
  });
});

describe("getProductsUploadDir", () => {
  it("appends the products folder to the upload root", () => {
    process.env.UPLOAD_DIR = "/tmp/farmamad-uploads";

    expect(getProductsUploadDir()).toBe(
      path.join("/tmp/farmamad-uploads", "products"),
    );
  });
});

describe("getPublicBaseUrl", () => {
  it("defaults to localhost on PORT or 3001", () => {
    expect(getPublicBaseUrl()).toBe(`http://localhost:${DEFAULT_PORT}`);

    process.env.PORT = "4100";

    expect(getPublicBaseUrl()).toBe("http://localhost:4100");
  });

  it("uses PUBLIC_BASE_URL and removes trailing slashes", () => {
    process.env.PUBLIC_BASE_URL = "https://api.farmamad.com/";

    expect(getPublicBaseUrl()).toBe("https://api.farmamad.com");

    process.env.PUBLIC_BASE_URL = "https://api.farmamad.com///";

    expect(getPublicBaseUrl()).toBe("https://api.farmamad.com");
  });
});
