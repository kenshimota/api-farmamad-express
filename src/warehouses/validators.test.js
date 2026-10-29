const {
  createWarehouseSchema,
  updateWarehouseSchema,
  parseWarehouseId,
  REQUIRED_WAREHOUSE_FIELDS,
} = require("./validators");
const { formatValidationErrors } = require("../auth/validators");

const VALID = {
  name: "Bodega Central",
  address: "Av. Monseñor Rivero 123",
};

/**
 * Validates a body with the create schema and the same options used by the
 * request middleware.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validate(body) {
  return createWarehouseSchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validates a body with the update schema.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validateUpdate(body) {
  return updateWarehouseSchema.validate(body, {
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

describe("createWarehouseSchema", () => {
  it("accepts a valid warehouse and trims the text fields", async () => {
    const data = await validate({
      name: "  Bodega Central  ",
      address: "  Av. Monseñor Rivero 123  ",
    });

    expect(data).toEqual({ ...VALID, observations: null });
  });

  it("defaults observations to null when it is omitted", async () => {
    await expect(validate(VALID)).resolves.toEqual({
      ...VALID,
      observations: null,
    });
  });

  it("accepts observations, trims it and keeps null as null", async () => {
    await expect(
      validate({ ...VALID, observations: "  Horario de 8 a 18  " }),
    ).resolves.toEqual({
      ...VALID,
      observations: "Horario de 8 a 18",
    });

    await expect(validate({ ...VALID, observations: null })).resolves.toEqual({
      ...VALID,
      observations: null,
    });
  });

  it("drops unknown and audit fields", async () => {
    const data = await validate({
      ...VALID,
      id: 1,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(data).toEqual({ ...VALID, observations: null });
  });

  it.each([
    ["name is empty", { name: "   " }, "name", "Nombre inválido"],
    ["name is not text", { name: { a: 1 } }, "name", "Nombre inválido"],
    ["address is empty", { address: "   " }, "address", "Dirección inválida"],
    [
      "address is not text",
      { address: { a: 1 } },
      "address",
      "Dirección inválida",
    ],
    [
      "observations is not text",
      { observations: { a: 1 } },
      "observations",
      "Observaciones inválidas",
    ],
  ])("rejects when %s", async (_case, overrides, field, message) => {
    const errors = await errorsFor({ ...VALID, ...overrides });

    expect(errors).toEqual({ [field]: message });
  });
});

describe("updateWarehouseSchema", () => {
  it("accepts name and address and trims them", async () => {
    await expect(
      validateUpdate({
        name: "  Bodega Sur  ",
        address: "  Calle 3 #10  ",
      }),
    ).resolves.toEqual({
      name: "Bodega Sur",
      address: "Calle 3 #10",
    });
  });

  it("does not add observations when it is omitted", async () => {
    const data = await validateUpdate(VALID);

    expect(data).toEqual(VALID);
    expect(data).not.toHaveProperty("observations");
  });

  it("keeps observations when it is sent, including null", async () => {
    await expect(
      validateUpdate({ ...VALID, observations: "  Nuevo horario  " }),
    ).resolves.toEqual({ ...VALID, observations: "Nuevo horario" });

    await expect(
      validateUpdate({ ...VALID, observations: null }),
    ).resolves.toEqual({ ...VALID, observations: null });
  });
});

describe("REQUIRED_WAREHOUSE_FIELDS", () => {
  it("lists the two fields required to create or update a warehouse", () => {
    expect(REQUIRED_WAREHOUSE_FIELDS).toEqual(["name", "address"]);
  });
});

describe("parseWarehouseId", () => {
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
    expect(parseWarehouseId(value)).toBe(expected);
  });
});
