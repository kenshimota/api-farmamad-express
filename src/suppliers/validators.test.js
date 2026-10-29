const {
  supplierSchema,
  MAX_ADDRESS_LENGTH,
  MAX_IDENTIFICATION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_OBSERVATIONS_LENGTH,
  MAX_PHONE_LENGTH,
  MIN_ADDRESS_LENGTH,
  MIN_IDENTIFICATION_LENGTH,
  MIN_NAME_LENGTH,
  MIN_PHONE_LENGTH,
  REQUIRED_SUPPLIER_FIELDS,
  EDITABLE_SUPPLIER_FIELDS,
} = require("./validators");
const { formatValidationErrors } = require("../auth/validators");

const VALID = {
  name: "Distribuidora La Salud C.A.",
  identification: "J-12345678-9",
  email: "ventas@lasalud.com",
  phone: "+58 212 555-1234",
  observations: "Entrega los martes",
  address: "Av. Principal, Galpón 4",
  city_id: 10,
  state_id: 4,
};

/**
 * Validates a body with the supplier schema and the same options used by the
 * request middleware.
 * @param {object} body - Request body.
 * @returns {Promise<object>} The validated data.
 */
function validate(body) {
  return supplierSchema.validate(body, {
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

describe("supplierSchema", () => {
  it("accepts a valid supplier and normalizes identification and email", async () => {
    const data = await validate({
      ...VALID,
      name: "  Distribuidora La Salud C.A.  ",
      identification: "  j-12345678-9 ",
      email: "  VENTAS@LaSalud.com ",
      observations: "  Entrega los martes  ",
    });

    expect(data).toEqual(VALID);
  });

  it("coerces numeric string foreign keys", async () => {
    await expect(
      validate({ ...VALID, city_id: "10", state_id: "4" }),
    ).resolves.toEqual(VALID);
  });

  it("accepts the documented minimum lengths", async () => {
    const data = await validate({
      ...VALID,
      name: "AB",
      identification: "ABCDE",
      phone: "1234567",
      address: "12345",
      observations: "",
    });

    expect(data.name).toBe("AB");
    expect(data.identification).toBe("ABCDE");
    expect(data.phone).toBe("1234567");
    expect(data.address).toBe("12345");
  });

  it("accepts the documented maximum lengths", async () => {
    const data = await validate({
      ...VALID,
      name: "a".repeat(MAX_NAME_LENGTH),
      identification: "A".repeat(MAX_IDENTIFICATION_LENGTH),
      email: `${"a".repeat(145)}@x.co`,
      phone: "1".repeat(MAX_PHONE_LENGTH),
      observations: "o".repeat(MAX_OBSERVATIONS_LENGTH),
      address: "a".repeat(MAX_ADDRESS_LENGTH),
    });

    expect(data.observations).toHaveLength(MAX_OBSERVATIONS_LENGTH);
  });

  it("makes observations optional and accepts null", async () => {
    const withoutObservations = { ...VALID };
    delete withoutObservations.observations;

    await expect(validate(withoutObservations)).resolves.not.toHaveProperty(
      "observations",
    );
    await expect(
      validate({ ...VALID, observations: null }),
    ).resolves.toHaveProperty("observations", null);
  });

  it("drops unknown and audit fields", async () => {
    const data = await validate({
      ...VALID,
      id: 1,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(data).toEqual(VALID);
  });

  it.each([
    ["name is empty", { ...VALID, name: "   " }, "Nombre inválido"],
    ["name is too short", { ...VALID, name: "A" }, "Nombre inválido"],
    ["name is a number", { ...VALID, name: 123 }, "Nombre inválido"],
    [
      "name exceeds 150 characters",
      { ...VALID, name: "a".repeat(MAX_NAME_LENGTH + 1) },
      "Nombre inválido",
    ],
    [
      "identification is too short",
      { ...VALID, identification: "A-1" },
      "Identificación inválida",
    ],
    [
      "identification exceeds 30 characters",
      {
        ...VALID,
        identification: "A".repeat(MAX_IDENTIFICATION_LENGTH + 1),
      },
      "Identificación inválida",
    ],
    [
      "identification has invalid characters",
      { ...VALID, identification: "J_12345678" },
      "Identificación inválida",
    ],
    [
      "identification is not text",
      { ...VALID, identification: { a: 1 } },
      "Identificación inválida",
    ],
    ["email is invalid", { ...VALID, email: "not-an-email" }, "Email inválido"],
    [
      "email exceeds 150 characters",
      { ...VALID, email: `${"a".repeat(146)}@x.co` },
      "Email inválido",
    ],
    ["email is not text", { ...VALID, email: 123 }, "Email inválido"],
    ["phone is too short", { ...VALID, phone: "123456" }, "Teléfono inválido"],
    [
      "phone exceeds 30 characters",
      { ...VALID, phone: "1".repeat(MAX_PHONE_LENGTH + 1) },
      "Teléfono inválido",
    ],
    [
      "phone has invalid characters",
      { ...VALID, phone: "555-CALL-NOW" },
      "Teléfono inválido",
    ],
    [
      "observations exceed 1000 characters",
      {
        ...VALID,
        observations: "o".repeat(MAX_OBSERVATIONS_LENGTH + 1),
      },
      "Observaciones inválidas",
    ],
    [
      "observations is not text",
      { ...VALID, observations: { a: 1 } },
      "Observaciones inválidas",
    ],
    [
      "address is too short",
      { ...VALID, address: "Av 1" },
      "Dirección inválida",
    ],
    [
      "address exceeds 255 characters",
      { ...VALID, address: "a".repeat(MAX_ADDRESS_LENGTH + 1) },
      "Dirección inválida",
    ],
    ["address is not text", { ...VALID, address: 123 }, "Dirección inválida"],
  ])("rejects when %s", async (_case, body, message) => {
    await expect(errorsFor(body)).resolves.toEqual(
      expect.objectContaining({
        [Object.keys(body).find((key) => body[key] !== VALID[key])]: message,
      }),
    );
  });

  it.each([
    ["city_id is zero", { ...VALID, city_id: 0 }],
    ["city_id is negative", { ...VALID, city_id: -1 }],
    ["city_id is decimal", { ...VALID, city_id: 1.5 }],
    ["city_id is not numeric", { ...VALID, city_id: "abc" }],
    ["state_id is zero", { ...VALID, state_id: 0 }],
    ["state_id is negative", { ...VALID, state_id: -1 }],
    ["state_id is decimal", { ...VALID, state_id: 1.5 }],
    ["state_id is not numeric", { ...VALID, state_id: "abc" }],
  ])("rejects when %s", async (_case, body) => {
    const field = body.city_id !== VALID.city_id ? "city_id" : "state_id";
    const message = field === "city_id" ? "Invalid city id" : "Invalid state";

    await expect(errorsFor(body)).resolves.toEqual({
      [field]: message,
    });
  });
});

describe("supplier field constants", () => {
  it("lists the required fields in the documented order", () => {
    expect(REQUIRED_SUPPLIER_FIELDS).toEqual([
      "name",
      "identification",
      "email",
      "phone",
      "address",
      "city_id",
      "state_id",
    ]);
  });

  it("lists every editable field", () => {
    expect(EDITABLE_SUPPLIER_FIELDS).toEqual([
      "name",
      "identification",
      "email",
      "phone",
      "observations",
      "address",
      "city_id",
      "state_id",
    ]);
  });

  it("exports the documented length limits", () => {
    expect({
      MIN_NAME_LENGTH,
      MAX_NAME_LENGTH,
      MIN_IDENTIFICATION_LENGTH,
      MAX_IDENTIFICATION_LENGTH,
      MIN_PHONE_LENGTH,
      MAX_PHONE_LENGTH,
      MIN_ADDRESS_LENGTH,
      MAX_ADDRESS_LENGTH,
      MAX_OBSERVATIONS_LENGTH,
    }).toEqual({
      MIN_NAME_LENGTH: 2,
      MAX_NAME_LENGTH: 150,
      MIN_IDENTIFICATION_LENGTH: 5,
      MAX_IDENTIFICATION_LENGTH: 30,
      MIN_PHONE_LENGTH: 7,
      MAX_PHONE_LENGTH: 30,
      MIN_ADDRESS_LENGTH: 5,
      MAX_ADDRESS_LENGTH: 255,
      MAX_OBSERVATIONS_LENGTH: 1000,
    });
  });
});
