const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");

const LIST_ORDER = Object.freeze([
  ["paid_at", "DESC"],
  ["id", "DESC"],
]);
const METHOD_ATTRIBUTES = Object.freeze([
  "id",
  "label",
  "is_active",
  "method_payment_type_id",
]);
const TYPE_ATTRIBUTES = Object.freeze(["id", "is_active", "currency_id"]);
const STATUS_ATTRIBUTES = Object.freeze(["code", "name"]);
const IMAGE_ATTRIBUTES = Object.freeze([
  "id",
  "url",
  "pathname",
  "reference",
  "thumbnail",
]);
const HISTORY_ATTRIBUTES = Object.freeze([
  "id",
  "payment_id",
  "from_status",
  "to_status",
  "reason",
  "actor_user_id",
  "createdAt",
]);
const ACTOR_ATTRIBUTES = Object.freeze(["id", "username", "email"]);

/**
 * Builds the include set of the payment reads. History is only nested when the
 * caller asks for it, so list endpoints keep their query small.
 * @param {object} models - Model dependencies.
 * @param {object} models.methodModel - MethodPayment model.
 * @param {object} models.currencyModel - Currency model.
 * @param {object} models.statusModel - PaymentStatus model.
 * @param {object} models.imageModel - Image model.
 * @param {object} models.historyModel - PaymentStatusHistory model.
 * @param {object} models.userModel - User model.
 * @param {boolean} [includeHistory] - Nest the append-only history.
 * @returns {object[]} Fresh include definitions.
 */
function buildPaymentIncludes(
  {
    methodModel,
    currencyModel,
    statusModel,
    imageModel,
    historyModel,
    userModel,
  },
  includeHistory = false,
) {
  const includes = [
    {
      model: methodModel,
      as: "method_payment",
      attributes: [...METHOD_ATTRIBUTES],
    },
    {
      model: currencyModel,
      as: "currency",
      attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
    },
    {
      model: statusModel,
      as: "status_detail",
      attributes: [...STATUS_ATTRIBUTES],
    },
    {
      model: imageModel,
      as: "reference_image",
      attributes: [...IMAGE_ATTRIBUTES],
    },
  ];

  if (includeHistory) {
    includes.push({
      model: historyModel,
      as: "history",
      attributes: [...HISTORY_ATTRIBUTES],
      include: [
        {
          model: userModel,
          as: "actor",
          attributes: [...ACTOR_ATTRIBUTES],
        },
      ],
    });
  }

  return includes;
}

/**
 * Builds the ordering of the nested history inside a payment detail.
 * @param {object} historyModel - PaymentStatusHistory model.
 * @returns {Array} Sequelize order clauses.
 */
function buildHistoryOrder(historyModel) {
  return [
    [{ model: historyModel, as: "history" }, "createdAt", "ASC"],
    [{ model: historyModel, as: "history" }, "id", "ASC"],
  ];
}

module.exports = {
  ACTOR_ATTRIBUTES,
  HISTORY_ATTRIBUTES,
  IMAGE_ATTRIBUTES,
  LIST_ORDER,
  METHOD_ATTRIBUTES,
  STATUS_ATTRIBUTES,
  TYPE_ATTRIBUTES,
  buildHistoryOrder,
  buildPaymentIncludes,
};
