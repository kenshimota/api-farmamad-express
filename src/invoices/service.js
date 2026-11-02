const { readField } = require("../shared/serializer");
const { invoiceRepository } = require("./repository");
const {
  customerProfileNotLinked,
  forbidden,
  invoiceNotFound,
  orderAlreadyInvoiced,
} = require("./errors");

const STATUS_PENDING = "pending";
const TAX_AMOUNT = 0;
const ADMIN_ROLES = Object.freeze(["admin", "seller"]);

/**
 * Rounds a numeric amount to two decimals.
 * @param {unknown} value - Raw amount.
 * @returns {number} The rounded amount or 0 when invalid.
 */
function round2(value) {
  const number = Number(value);

  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

/**
 * Calculates a line subtotal as `quantity × unit_price`.
 * @param {object} item - Line with quantity and unit_price.
 * @returns {number} The rounded subtotal.
 */
function calculateItemSubtotal(item) {
  return round2(Number(item.quantity) * Number(item.unit_price));
}

/**
 * Calculates `issued_at + payment_terms.days` as a `YYYY-MM-DD` date.
 * Invalid or missing days mean cash, so the issue date is returned.
 * @param {Date|string} issuedAt - Invoice issue instant.
 * @param {unknown} days - Payment term days.
 * @returns {string} The due date without time.
 */
function calculateDueDate(issuedAt, days) {
  const parsed = new Date(issuedAt);
  const amount = Number.isInteger(days) && days >= 0 ? days : 0;
  const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const date = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + amount,
    ),
  );

  return date.toISOString().slice(0, 10);
}

/**
 * Normalizes the line snapshots and calculates their subtotals.
 * @param {object[]} items - Requested line snapshots.
 * @returns {object[]} Normalized lines.
 */
function normalizeItems(items) {
  return items.map((item) => ({
    ...item,
    unit_price: round2(item.unit_price),
    subtotal:
      item.subtotal === undefined
        ? calculateItemSubtotal(item)
        : round2(item.subtotal),
  }));
}

/**
 * Builds the persisted invoice header from the order snapshot.
 * @param {object} input - Validated invoice snapshot.
 * @param {object} context - Calculated context.
 * @param {number} context.number - Sequence number.
 * @param {Date} context.issuedAt - Issue instant.
 * @param {number} context.subtotal - Invoice subtotal.
 * @param {number} context.total - Invoice total.
 * @returns {object} Invoice attribute values.
 */
function buildInvoiceValues(input, { number, issuedAt, subtotal, total }) {
  return {
    number,
    order_id: input.order_id ?? null,
    customer_id: input.customer_id,
    invoiced_by_user_id: input.invoiced_by_user_id,
    currency_id: input.currency_id,
    payment_term_id: input.payment_term_id ?? null,
    subtotal,
    tax_amount: TAX_AMOUNT,
    total,
    paid_amount: 0,
    payment_status: STATUS_PENDING,
    issued_at: issuedAt,
    due_date:
      input.due_date ??
      calculateDueDate(issuedAt, input.payment_term_days ?? 0),
    notes: input.notes ?? null,
  };
}

/**
 * Creates the invoices service. Every business rule lives here so routers only
 * parse, authorize and serialize. The repository and clock are injectable.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Invoice repository.
 * @param {function(): Date} [dependencies.clock] - Clock for `issued_at`.
 * @returns {object} The invoices service.
 */
function createInvoiceService({
  repository = invoiceRepository,
  clock = () => new Date(),
} = {}) {
  /**
   * Resolves the customer scope of the authenticated actor.
   * @param {object} actor - JWT payload.
   * @returns {Promise<{ role: string, customerId: number|null }>} The viewer.
   * @throws {Error} 403 when the role is not allowed or the profile is missing.
   */
  async function resolveViewer(actor) {
    const role = actor?.role;

    if (ADMIN_ROLES.includes(role)) {
      return { role, customerId: null };
    }

    if (role !== "customer") {
      throw forbidden();
    }

    const user = await repository.findUserById(actor.sub, undefined);
    const customerId = user ? readField(user, "customer_id") : null;

    if (customerId === null || customerId === undefined) {
      throw customerProfileNotLinked();
    }

    return { role, customerId: Number(customerId) };
  }

  /**
   * Enforces the customer ownership rule.
   * @param {object} invoice - Loaded invoice.
   * @param {object} viewer - Resolved viewer.
   * @returns {void}
   * @throws {Error} 404 when a customer asks for another customer's invoice.
   */
  function assertOwnership(invoice, viewer) {
    if (
      viewer.role === "customer" &&
      Number(readField(invoice, "customer_id")) !== viewer.customerId
    ) {
      throw invoiceNotFound();
    }
  }

  /**
   * Loads an invoice detail with its lines and applies the access rules.
   * @param {number} id - Invoice id.
   * @param {object} actor - JWT payload.
   * @returns {Promise<object>} The invoice.
   */
  async function getInvoice(id, actor) {
    const viewer = await resolveViewer(actor);
    const includeInvoicedBy = viewer.role !== "customer";
    const invoice = await repository.findById(id, {
      includeItems: true,
      includeInvoicedBy,
    });

    if (!invoice) {
      throw invoiceNotFound();
    }

    assertOwnership(invoice, viewer);

    return invoice;
  }

  /**
   * Loads the invoice of an order with the same access rules as the detail.
   * The route `GET /orders/:id/invoice` is mounted by the orders module once
   * HU-39 (#63) exists; this method already exposes the behavior.
   * @param {number} orderId - Order id.
   * @param {object} actor - JWT payload.
   * @returns {Promise<object>} The invoice.
   */
  async function getInvoiceByOrder(orderId, actor) {
    const viewer = await resolveViewer(actor);
    const includeInvoicedBy = viewer.role !== "customer";
    const invoice = await repository.findByOrderId(orderId, {
      includeItems: true,
      includeInvoicedBy,
    });

    if (!invoice) {
      throw invoiceNotFound();
    }

    assertOwnership(invoice, viewer);

    return invoice;
  }

  return {
    /**
     * Lists invoices ordered by issue date and id descending.
     * @param {object} [filters] - Exact listing filters.
     * @returns {Promise<object[]>} The matching invoices.
     */
    listInvoices(filters) {
      return repository.list(filters);
    },

    getInvoice,
    getInvoiceByOrder,

    /**
     * Creates the immutable invoice and its snapshot lines inside a single
     * transaction. This is the building block the `generate → invoiced`
     * transition of HU-39 (#63) will call once the orders module exists; the
     * order lock, status validation, reservation consumption and history
     * events belong to that transition and are intentionally not faked here.
     * @param {object} input - Invoice snapshot copied from the order.
     * @returns {Promise<object>} The created invoice with its lines.
     */
    createInvoice(input) {
      return repository.transaction(async (transaction) => {
        if (input.order_id !== undefined && input.order_id !== null) {
          const exists = await repository.hasOrderInvoice(
            input.order_id,
            transaction,
          );

          if (exists) {
            throw orderAlreadyInvoiced();
          }
        }

        const items = normalizeItems(input.items ?? []);
        const subtotal =
          input.subtotal === undefined
            ? round2(items.reduce((sum, item) => sum + item.subtotal, 0))
            : round2(input.subtotal);
        const total =
          input.total === undefined ? subtotal : round2(input.total);
        const issuedAt = input.issued_at ? new Date(input.issued_at) : clock();
        const number = await repository.nextNumber(transaction);
        const invoice = await repository.create(
          buildInvoiceValues(input, { number, issuedAt, subtotal, total }),
          { transaction },
        );

        if (items.length > 0) {
          await repository.createItems(
            items.map((item) => ({
              invoice_id: invoice.id,
              order_item_id: item.order_item_id ?? null,
              product_id: item.product_id,
              product_name: item.product_name,
              product_reference: item.product_reference,
              item_state_id: item.item_state_id,
              item_state_name: item.item_state_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
            })),
            { transaction },
          );
        }

        return repository.findById(invoice.id, {
          includeItems: true,
          includeInvoicedBy: true,
          transaction,
        });
      });
    },
  };
}

const invoiceService = createInvoiceService();

module.exports = {
  ADMIN_ROLES,
  TAX_AMOUNT,
  buildInvoiceValues,
  calculateDueDate,
  calculateItemSubtotal,
  createInvoiceService,
  invoiceService,
  normalizeItems,
  round2,
};
