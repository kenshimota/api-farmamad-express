const yup = require("yup");

const PASSWORD_MIN_LENGTH = 8;

/**
 * Builds a fresh password schema with the shared rules.
 * @returns {import("yup").StringSchema} The password schema.
 */
function passwordField() {
  return yup
    .string()
    .typeError("Password must be at least 8 characters long")
    .min(PASSWORD_MIN_LENGTH, "Password must be at least 8 characters long");
}

const loginSchema = yup.object({
  identifier: yup
    .string()
    .trim()
    .typeError("Invalid email or username")
    .test(
      "is-email",
      "Invalid email",
      (value) =>
        !value.includes("@") || yup.string().email().isValidSync(value),
    ),
  password: passwordField(),
});

const registerAdminSchema = yup.object({
  username: yup.string().trim().typeError("Invalid username"),
  email: yup.string().trim().typeError("Invalid email").email("Invalid email"),
  password: passwordField(),
  name: yup.string().trim().nullable(),
});

const INVALID_EMAIL_MESSAGE = "Email inválido";
const INVALID_CODE_MESSAGE = "El código debe tener 8 dígitos";

/**
 * Builds the email schema shared by the recovery endpoints.
 * @returns {import("yup").StringSchema} The email schema.
 */
function emailField() {
  return yup
    .string()
    .trim()
    .typeError(INVALID_EMAIL_MESSAGE)
    .email(INVALID_EMAIL_MESSAGE);
}

const forgotPasswordSchema = yup.object({
  email: emailField(),
});

const verifyResetCodeSchema = yup.object({
  email: emailField(),
  code: yup
    .string()
    .typeError(INVALID_CODE_MESSAGE)
    .matches(/^\d{8}$/, INVALID_CODE_MESSAGE),
});

const resetPasswordSchema = yup.object({
  password: passwordField(),
  passwordConfirmation: yup
    .string()
    .typeError("Passwords do not match")
    .oneOf([yup.ref("password")], "Passwords do not match"),
});

/**
 * Flattens a yup validation error into the API error map.
 * @param {import("yup").ValidationError} error - The yup validation error.
 * @returns {Record<string, string>} Map of field name to error message.
 */
function formatValidationErrors(error) {
  const errors = {};

  for (const issue of error.inner ?? [error]) {
    if (errors[issue.path] === undefined) {
      errors[issue.path] = issue.message;
    }
  }

  return errors;
}

/**
 * Flattens a login validation error. The identifier is reported as `email`
 * when it looks like an email so the payload matches the API contract.
 * @param {import("yup").ValidationError} error - The yup validation error.
 * @param {unknown} identifier - The identifier sent by the client.
 * @returns {Record<string, string>} Map of field name to error message.
 */
function formatLoginErrors(error, identifier) {
  const errors = formatValidationErrors(error);

  if (
    errors.identifier !== undefined &&
    typeof identifier === "string" &&
    identifier.includes("@")
  ) {
    errors.email = errors.identifier;
    delete errors.identifier;
  }

  return errors;
}

/**
 * Lists the required fields that are missing from a request body.
 * @param {object} body - Request body.
 * @param {string[]} fields - Required field names.
 * @returns {string[]} The missing field names.
 */
function missingFields(body = {}, fields = []) {
  return fields.filter(
    (field) =>
      body[field] === undefined || body[field] === null || body[field] === "",
  );
}

/**
 * Builds the 400 message listing the missing required fields.
 * @param {string[]} fields - Missing field names.
 * @returns {string} Human readable message.
 */
function requiredFieldsMessage(fields) {
  if (fields.length === 1) {
    return `${fields[0]} is required`;
  }

  const last = fields[fields.length - 1];
  return `${fields.slice(0, -1).join(", ")} and ${last} are required`;
}

module.exports = {
  PASSWORD_MIN_LENGTH,
  loginSchema,
  registerAdminSchema,
  forgotPasswordSchema,
  verifyResetCodeSchema,
  resetPasswordSchema,
  formatValidationErrors,
  formatLoginErrors,
  missingFields,
  requiredFieldsMessage,
};
