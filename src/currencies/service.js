const { currencyRepository } = require("./repository");
const {
  baseCannotBeDeactivated,
  baseRateLocked,
  defaultCannotBeDeactivated,
} = require("./errors");

const EDITABLE_FIELDS = Object.freeze(["name", "symbol", "is_active"]);

/**
 * Copies the fields present in the validated body, ignoring the absent ones so
 * a partial update never overwrites a stored value with `undefined`.
 * @param {object} source - Validated update attributes.
 * @param {string[]} fields - Field names accepted by the operation.
 * @returns {object} The attributes that must be persisted.
 */
function pickDefined(source, fields) {
  return fields.reduce((picked, field) => {
    if (source[field] !== undefined) {
      picked[field] = source[field];
    }

    return picked;
  }, {});
}

/**
 * Creates the currencies service. Every business rule lives here so the
 * routers only parse, authorize and serialize. The repository is injectable
 * for unit tests.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Currency repository.
 * @returns {object} The currencies service.
 */
function createCurrencyService({ repository = currencyRepository } = {}) {
  return {
    /**
     * Lists the currency catalog with the base currency first.
     * @param {object} [options] - Listing options.
     * @param {boolean} [options.includeInactive] - Include deactivated rows.
     * @returns {Promise<object[]>} The currencies.
     */
    listCurrencies({ includeInactive = false } = {}) {
      return repository.list({ includeInactive });
    },

    /**
     * Reads the append-only rate history of one currency.
     * @param {number} currencyId - Currency id.
     * @returns {Promise<object[]>} History rows ordered by changed_at DESC.
     */
    getRateHistory(currencyId) {
      return repository.listHistory(currencyId);
    },

    /**
     * Creates a currency as non-base and active, together with the first
     * history row. Both inserts share one transaction.
     * @param {object} values - Validated currency attributes.
     * @param {number|string|null} [userId] - Authenticated user id.
     * @returns {Promise<object>} The created currency.
     */
    async createCurrency(values, userId = null) {
      return repository.transaction(async (transaction) => {
        const currency = await repository.create(
          {
            ...values,
            code: String(values.code).toUpperCase(),
            is_base: false,
            is_active: true,
          },
          { transaction },
        );

        await repository.createHistory(
          {
            currency_id: currency.id,
            previous_rate: null,
            new_rate: currency.rate ?? values.rate,
            changed_by: userId ?? null,
            reason: null,
          },
          { transaction },
        );

        return currency;
      });
    },

    /**
     * Updates a currency. A rate change updates the row and appends history
     * inside one transaction; changing only name, symbol or is_active does not
     * create history. The base currency keeps `rate = 1` and cannot be
     * deactivated.
     * @param {object} currency - Loaded currency instance.
     * @param {object} values - Validated update attributes, including reason.
     * @param {number|string|null} [userId] - Authenticated user id.
     * @returns {Promise<object>} The updated currency.
     * @throws {Error} 409 for the protected base currency rules.
     */
    async updateCurrency(currency, values, userId = null) {
      const base = currency.is_base === true;
      const currentRate = Number(currency.rate);
      const newRate =
        values.rate === undefined ? undefined : Number(values.rate);
      const rateChanged = newRate !== undefined && newRate !== currentRate;

      if (base && newRate !== undefined && newRate !== 1) {
        throw baseRateLocked();
      }

      if (base && values.is_active === false) {
        throw baseCannotBeDeactivated();
      }

      if (
        currency.is_default_for_transactions === true &&
        values.is_active === false
      ) {
        throw defaultCannotBeDeactivated();
      }

      const updates = pickDefined(values, EDITABLE_FIELDS);

      if (!base && rateChanged) {
        updates.rate = values.rate;
      }

      return repository.transaction(async (transaction) => {
        const updated = await repository.update(currency, updates, {
          transaction,
        });

        if (!base && rateChanged) {
          await repository.createHistory(
            {
              currency_id: currency.id,
              previous_rate: currentRate,
              new_rate: newRate,
              changed_by: userId ?? null,
              reason: values.reason ?? null,
            },
            { transaction },
          );
        }

        return updated;
      });
    },

    /**
     * Deactivates a currency without deleting it, so the rate history survives.
     * The base currency can never be deactivated.
     * @param {object} currency - Loaded currency instance.
     * @returns {Promise<object>} The updated currency.
     * @throws {Error} 409 when the currency is the base one.
     */
    async deactivateCurrency(currency) {
      if (currency.is_base === true) {
        throw baseCannotBeDeactivated();
      }

      if (currency.is_default_for_transactions === true) {
        throw defaultCannotBeDeactivated();
      }

      return repository.update(currency, { is_active: false });
    },
  };
}

const currencyService = createCurrencyService();

module.exports = { createCurrencyService, currencyService };
