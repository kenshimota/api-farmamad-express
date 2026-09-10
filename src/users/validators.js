const yup = require("yup");
const { PASSWORD_MIN_LENGTH } = require("../auth/validators");

const REQUIRED_USER_FIELDS = ["username", "email", "password", "role"];

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

module.exports = { createUserSchema, REQUIRED_USER_FIELDS };
