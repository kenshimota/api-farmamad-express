const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const { LOCATION_INCLUDE, supplierRepository } = require("./repository");
const {
  CITY_ID_MESSAGE,
  LOCATION_MESSAGE,
  STATE_ID_MESSAGE,
  parseSupplierId,
} = require("./validators");

const FOREIGN_KEY_FIELDS = Object.freeze(["city_id", "state_id"]);

/**
 * Builds the middleware that loads a supplier by its route id. The loader can
 * include the location for the detail endpoint; the write endpoints use the
 * plain version. Invalid ids answer 422 and missing rows answer 404.
 * @param {object} [options] - Loader options.
 * @param {boolean} [options.includeLocation] - Include city and state.
 * @returns {import("express").RequestHandler} The loader middleware.
 */
function createSupplierLoader({ includeLocation = false } = {}) {
  return async function loadSupplier(req, res, next) {
    const id = parseSupplierId(req.params.id);

    if (id === null) {
      return res.status(422).json({ errors: { id: "Invalid supplier id" } });
    }

    const supplier = await supplierRepository.findById(id, {
      includeLocation,
    });

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    req.supplier = supplier;

    return next();
  };
}

const loadSupplier = createSupplierLoader();
const loadSupplierWithLocation = createSupplierLoader({
  includeLocation: true,
});

/**
 * Express middleware that verifies the geographic references before a create
 * or update reaches the database. On updates it derives the state when only
 * the city changes and validates the final pair otherwise. The foreign keys of
 * the migration remain the final safeguard for concurrent deletions.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function ensureLocation(req, res, next) {
  const validated = req.validated;
  const hasCity = validated.city_id !== undefined;
  const hasState = validated.state_id !== undefined;

  if (!hasCity && !hasState) {
    return next();
  }

  let city = null;

  if (hasCity) {
    city = await supplierRepository.findCity(validated.city_id);

    if (!city) {
      return res.status(422).json({ errors: { city_id: CITY_ID_MESSAGE } });
    }
  }

  if (hasState && !(await supplierRepository.stateExists(validated.state_id))) {
    return res.status(422).json({ errors: { state_id: STATE_ID_MESSAGE } });
  }

  if (!city && req.supplier) {
    city = await supplierRepository.findCity(req.supplier.city_id);
  }

  if (city) {
    const targetStateId = hasState ? validated.state_id : city.state_id;

    if (targetStateId !== city.state_id) {
      return res.status(422).json({ errors: { city_id: LOCATION_MESSAGE } });
    }

    if (!hasState) {
      validated.state_id = city.state_id;
    }
  }

  return next();
}

/**
 * Reads the foreign key field named by a Sequelize constraint error. The
 * field can come as an object, an array or only inside the driver message.
 * @param {ForeignKeyConstraintError} error - Sequelize constraint error.
 * @returns {string|null} The matching field name or null.
 */
function foreignKeyField(error) {
  const fields = error.fields;
  const candidates = Array.isArray(fields) ? fields : Object.keys(fields ?? {});

  const direct = candidates.find((field) => FOREIGN_KEY_FIELDS.includes(field));

  if (direct) {
    return direct;
  }

  const message = `${error.message ?? ""} ${
    error.parent?.detail ?? ""
  }`.toLowerCase();

  return FOREIGN_KEY_FIELDS.find((field) => message.includes(field)) ?? null;
}

/**
 * Translates the persistence errors of the create and update handlers into
 * HTTP responses: a duplicated identification answers 409, a foreign key
 * violation answers 422 for the affected field, and any other error is
 * rethrown so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The error response.
 * @throws {unknown} The original error when it cannot be classified.
 */
function handleWriteError(error, res) {
  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: "Supplier already exists" });
  }

  if (error instanceof ForeignKeyConstraintError) {
    const field = foreignKeyField(error);

    if (field === "city_id") {
      return res.status(422).json({ errors: { city_id: CITY_ID_MESSAGE } });
    }

    if (field === "state_id") {
      return res.status(422).json({ errors: { state_id: STATE_ID_MESSAGE } });
    }
  }

  throw error;
}

/**
 * Translates the persistence errors of the delete handler into HTTP responses:
 * a supplier referenced by a purchase answers 409, any other error is rethrown
 * so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The 409 response.
 * @throws {unknown} The original error when it is not a foreign key violation.
 */
function handleDeleteError(error, res) {
  if (error instanceof ForeignKeyConstraintError) {
    return res.status(409).json({ message: "Supplier is in use" });
  }

  throw error;
}

module.exports = {
  LOCATION_INCLUDE,
  createSupplierLoader,
  ensureLocation,
  handleDeleteError,
  handleWriteError,
  loadSupplier,
  loadSupplierWithLocation,
};
