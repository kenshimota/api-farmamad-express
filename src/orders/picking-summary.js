/**
 * Builds the preparation summary from the already serialized lines.
 * @param {object[]} items - Serialized picking lines.
 * @returns {object} The summary block.
 */
function toPickingSummary(items) {
  const orderedUnits = items.reduce((total, item) => total + item.quantity, 0);
  const allocatedUnits = items.reduce(
    (total, item) => total + item.allocated_quantity,
    0,
  );
  const lotsCount = items.reduce((total, item) => total + item.lots.length, 0);
  const ready =
    items.length > 0 &&
    items.every(
      (item) =>
        item.pending_quantity === 0 &&
        item.allocated_quantity === item.quantity,
    );

  return {
    lines_count: items.length,
    lots_count: lotsCount,
    ordered_units: orderedUnits,
    allocated_units: allocatedUnits,
    pending_units: Math.max(0, orderedUnits - allocatedUnits),
    ready,
  };
}

module.exports = { toPickingSummary };
