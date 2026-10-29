const {
  changedProtectedFields,
  pickDefined,
  planUpdate,
  sameFieldsDefinition,
  stableStringify,
} = require("./update-policy");

const FIELD = Object.freeze({
  key: "email",
  label: "Correo de PayPal",
  type: "email",
  required: true,
});

/**
 * Builds a stored type double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The type double.
 */
function storedType(overrides = {}) {
  return {
    id: 1,
    currency_id: 3,
    fields: [FIELD],
    ...overrides,
  };
}

describe("update policy helpers", () => {
  it("copies only the fields that are present", () => {
    expect(
      pickDefined({ name: "Banco", description: undefined, is_active: false }, [
        "name",
        "description",
        "is_active",
      ]),
    ).toEqual({ name: "Banco", is_active: false });
  });

  it("compares fields definitions ignoring property order", () => {
    const reordered = {
      required: true,
      type: "email",
      label: "Correo",
      key: "email",
    };
    const original = {
      key: "email",
      label: "Correo",
      type: "email",
      required: true,
    };

    expect(stableStringify(reordered)).toBe(stableStringify(original));
    expect(sameFieldsDefinition([reordered], [original])).toBe(true);
    expect(sameFieldsDefinition([original], [])).toBe(false);
  });

  it("ignores protected values that keep their stored value", () => {
    const type = storedType();

    expect(
      changedProtectedFields(type, {
        currency_id: "3",
        fields: [{ ...FIELD }],
      }),
    ).toEqual([]);
  });

  it("detects changed currency_id and fields", () => {
    const type = storedType();

    expect(
      changedProtectedFields(type, {
        currency_id: 4,
        fields: [{ ...FIELD, required: false }],
      }),
    ).toEqual(["currency_id", "fields"]);
  });
});

describe("planUpdate", () => {
  it("blocks a protected change when the type has methods", () => {
    const plan = planUpdate({
      type: storedType(),
      values: { currency_id: 4 },
      hasMethods: true,
    });

    expect(plan).toEqual({ conflict: true, checkCurrency: false, updates: {} });
  });

  it("keeps only the always-editable fields when the type has methods", () => {
    const plan = planUpdate({
      type: storedType(),
      values: {
        name: "PayPal",
        description: null,
        is_active: false,
        currency_id: 3,
        fields: [{ ...FIELD }],
      },
      hasMethods: true,
    });

    expect(plan).toEqual({
      conflict: false,
      checkCurrency: false,
      updates: { name: "PayPal", description: null, is_active: false },
    });
  });

  it("allows currency_id and fields when the type has no methods", () => {
    const fields = [{ ...FIELD, required: false }];
    const plan = planUpdate({
      type: storedType(),
      values: { currency_id: 4, fields },
      hasMethods: false,
    });

    expect(plan).toEqual({
      conflict: false,
      checkCurrency: true,
      updates: { currency_id: 4, fields },
    });
  });

  it("skips the currency check when the stored currency is kept", () => {
    const plan = planUpdate({
      type: storedType(),
      values: { currency_id: 3, name: "PayPal" },
      hasMethods: false,
    });

    expect(plan).toEqual({
      conflict: false,
      checkCurrency: false,
      updates: { name: "PayPal", currency_id: 3 },
    });
  });
});
