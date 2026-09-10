const yup = require("yup");

const PASSWORD_MIN_LENGTH = 8;

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
  password: yup
    .string()
    .typeError("Password must be at least 8 characters long")
    .min(PASSWORD_MIN_LENGTH, "Password must be at least 8 characters long"),
});

/**
 * Flattens a yup validation error into the API error map. The identifier is
 * reported as `email` when it looks like an email so the payload matches the
 * API contract.
 * @param {import("yup").ValidationError} error - The yup validation error.
 * @param {unknown} identifier - The identifier sent by the client.
 * @returns {Record<string, string>} Map of field name to error message.
 */
function formatLoginErrors(error, identifier) {
  const errors = {};

  for (const issue of error.inner ?? [error]) {
    const isEmail =
      issue.path === "identifier" &&
      typeof identifier === "string" &&
      identifier.includes("@");
    const key =
      issue.path === "identifier"
        ? isEmail
          ? "email"
          : "identifier"
        : issue.path;
    errors[key] = issue.message;
  }

  return errors;
}

module.exports = { loginSchema, formatLoginErrors };
