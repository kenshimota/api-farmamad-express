/**
 * Returns the units that can still be reserved in a lot.
 * @param {object} lot - Lot instance with `stock` and `reserved`.
 * @returns {number} The non-negative available quantity.
 */
function availableQuantity(lot) {
  return Math.max(0, Number(lot.stock) - Number(lot.reserved));
}

/**
 * Plans an FEFO reservation over the already ordered lots. The function is
 * pure: it never mutates the lots, so the caller can validate every line
 * before touching the database.
 * @param {object[]} lots - Available lots ordered by expiration date and id.
 * @param {number} quantity - Units requested by the line.
 * @returns {{ allocations: Array<{ lot: object, quantity: number }>,
 *   remaining: number }} The chosen lots and the units still missing.
 */
function planLotAllocations(lots, quantity) {
  const allocations = [];
  let remaining = Number(quantity);

  for (const lot of lots) {
    if (remaining <= 0) {
      break;
    }

    const available = availableQuantity(lot);

    if (available <= 0) {
      continue;
    }

    const taken = Math.min(available, remaining);

    allocations.push({ lot, quantity: taken });
    remaining -= taken;
  }

  return { allocations, remaining };
}

module.exports = { availableQuantity, planLotAllocations };
