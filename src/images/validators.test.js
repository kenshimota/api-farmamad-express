const {
  imageSchema,
  MAX_PATHNAME_LENGTH,
  MAX_REFERENCE_LENGTH,
  MAX_URL_LENGTH,
  parseImageId,
  REQUIRED_IMAGE_FIELDS,
} = require("./validators");
const { formatValidationErrors } = require("../auth/validators");

const URL_BASE = "https://cdn.farmamad.com/";
const VALID = {
  url: "https://cdn.farmamad.com/products/ibuprofeno.png",
  pathname: "/uploads/products/ibuprofeno.png",
  reference: "ibuprofeno-400",
  thumbnail: "https://cdn.farmamad.com/products/ibuprofeno-thumb.png",
};

/**
 * Validates a body with the image schema and the same options used by the
 * request middleware.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validate(body) {
  return imageSchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validates a body and flattens the yup error the same way the API does.
 * @param {object} body - Request body.
 * @returns {Promise<Record<string, string>|null>} Error map or null.
 */
async function errorsFor(body) {
  try {
    await validate(body);

    return null;
  } catch (error) {
    return formatValidationErrors(error);
  }
}

describe("imageSchema", () => {
  it("accepts a valid image and trims reference and pathname", async () => {
    await expect(
      validate({
        ...VALID,
        reference: "  ibuprofeno-400  ",
        pathname: "  /uploads/products/ibuprofeno.png  ",
      }),
    ).resolves.toEqual(VALID);
  });

  it("defaults pathname to null when it is omitted", async () => {
    const { pathname, ...withoutPathname } = VALID;

    await expect(validate(withoutPathname)).resolves.toEqual({
      ...withoutPathname,
      pathname: null,
    });
  });

  it("accepts a null pathname", async () => {
    await expect(validate({ ...VALID, pathname: null })).resolves.toEqual({
      ...VALID,
      pathname: null,
    });
  });

  it("accepts values with exactly the maximum length", async () => {
    const url = URL_BASE + "a".repeat(MAX_URL_LENGTH - URL_BASE.length);
    const pathname = "/" + "a".repeat(MAX_PATHNAME_LENGTH - 1);
    const reference = "a".repeat(MAX_REFERENCE_LENGTH);

    await expect(
      validate({ url, pathname, reference, thumbnail: url }),
    ).resolves.toEqual({ url, pathname, reference, thumbnail: url });
  });

  it("drops unknown and audit fields", async () => {
    const data = await validate({
      ...VALID,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(data).toEqual(VALID);
  });

  it.each([
    ["url is not a URL", { url: "not-a-url" }],
    ["url is blank", { url: "   " }],
    ["url is not text", { url: 123 }],
    ["url exceeds 2048 characters", { url: URL_BASE + "a".repeat(2048) }],
  ])("rejects when %s", async (_case, overrides) => {
    await expect(errorsFor({ ...VALID, ...overrides })).resolves.toEqual({
      url: "URL inválida",
    });
  });

  it.each([
    ["reference is blank", { reference: "   " }],
    ["reference is not text", { reference: 123 }],
    ["reference exceeds 100 characters", { reference: "a".repeat(101) }],
  ])("rejects when %s", async (_case, overrides) => {
    await expect(errorsFor({ ...VALID, ...overrides })).resolves.toEqual({
      reference: "Referencia inválida",
    });
  });

  it.each([
    ["thumbnail is not a URL", { thumbnail: "not-a-url" }],
    ["thumbnail is blank", { thumbnail: "   " }],
    ["thumbnail is not text", { thumbnail: 123 }],
    [
      "thumbnail exceeds 2048 characters",
      { thumbnail: URL_BASE + "a".repeat(2048) },
    ],
  ])("rejects when %s", async (_case, overrides) => {
    await expect(errorsFor({ ...VALID, ...overrides })).resolves.toEqual({
      thumbnail: "Miniatura inválida",
    });
  });

  it.each([
    ["pathname is blank", { pathname: "   " }],
    ["pathname is not text", { pathname: 123 }],
    ["pathname exceeds 2048 characters", { pathname: "/" + "a".repeat(2048) }],
  ])("rejects when %s", async (_case, overrides) => {
    await expect(errorsFor({ ...VALID, ...overrides })).resolves.toEqual({
      pathname: "Ruta inválida",
    });
  });
});

describe("REQUIRED_IMAGE_FIELDS", () => {
  it("lists url, reference and thumbnail as required fields", () => {
    expect(REQUIRED_IMAGE_FIELDS).toEqual(["url", "reference", "thumbnail"]);
  });
});

describe("parseImageId", () => {
  it.each([
    [1, 1],
    ["2", 2],
    ["  3  ", 3],
    ["0", null],
    ["-1", null],
    ["1.5", null],
    ["abc", null],
    ["", null],
    [0, null],
    [-1, null],
    [1.5, null],
    [null, null],
    [undefined, null],
    [{}, null],
  ])("parses %p as %p", (value, expected) => {
    expect(parseImageId(value)).toBe(expected);
  });
});
