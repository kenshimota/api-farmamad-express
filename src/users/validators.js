const yup = require("yup");
const { PASSWORD_MIN_LENGTH } = require("../auth/validators");

const REQUIRED_USER_FIELDS = ["username", "email", "password", "role"];
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const createUserSchema = yup.object({
  username: yup.string().trim().typeError("Invalid username"),
  email: yup.string().trim().typeError("Invalid email").email("Invalid email"),
  password: yup
    .string()
    .typeError("Password must be at least 8 characters long")
    .min(PASSWORD_MIN_LENGTH, "Password must be at least 8 characters long"),
  name: yup.string().trim().nullable(),
  role: yup.string().trim().typeError("Invalid role"),
});

const updateUserStatusSchema = yup.object({
  isBlocked: yup.boolean().strict().typeError("isBlocked must be a boolean"),
});

/**
 * Parses a user id coming from a route parameter. Only positive integers are
 * accepted; anything else (decimals, negatives, non numeric values) is
 * reported as null so the caller can answer 422.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseUserId(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!POSITIVE_INTEGER_PATTERN.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  return parsed >= 1 ? parsed : null;
}

module.exports = {
  createUserSchema,
  updateUserStatusSchema,
  parseUserId,
  REQUIRED_USER_FIELDS,
};
