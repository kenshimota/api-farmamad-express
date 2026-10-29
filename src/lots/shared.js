const { lotService } = require("./service");
const { invalidLotId, lotNotFound, sendHttpError } = require("./errors");
const { parseLotId } = require("./parsers");

/**
 * Express middleware for the lot routes addressed by `:id`. It parses the
 * parameter, loads the lot with its relations and answers 422/404 when needed.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after continuing or responding.
 */
async function loadLot(req, res, next) {
  const id = parseLotId(req.params.id);

  if (id === null) {
    return sendHttpError(res, invalidLotId());
  }

  const lot = await lotService.getLot(id);

  if (!lot) {
    return sendHttpError(res, lotNotFound());
  }

  req.lot = lot;

  return next();
}

module.exports = { loadLot };
