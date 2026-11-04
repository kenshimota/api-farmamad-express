const { readField } = require("../shared/serializer");
const { toDateOnly, toQuantity } = require("./picking-values");

/**
 * Builds the three location blocks of a lot. A partial location is treated as
 * missing so the operator never receives an incomplete address.
 * @param {object} lot - Lot instance or plain object.
 * @returns {{ warehouse: object|null, shelf: object|null, section: object|null }}
 *   The public location.
 */
function toPickingLocation(lot) {
  const warehouse = readField(lot, "warehouse");
  const shelf = readField(lot, "shelf");
  const section = readField(lot, "section");

  if (!warehouse || !shelf || !section) {
    return { warehouse: null, shelf: null, section: null };
  }

  return {
    warehouse: {
      id: readField(warehouse, "id"),
      name: readField(warehouse, "name"),
    },
    shelf: {
      id: readField(shelf, "id"),
      code: readField(shelf, "code"),
      name: readField(shelf, "name") ?? null,
    },
    section: {
      id: readField(section, "id"),
      code: readField(section, "code"),
      name: readField(section, "name") ?? null,
    },
  };
}

/**
 * Builds the public representation of the lot assigned to an order line.
 * `available` is the remaining inventory, not the quantity to pick.
 * @param {object} lot - Lot instance or plain object.
 * @returns {object} Public lot data.
 */
function toPickingLot(lot) {
  const stock = toQuantity(readField(lot, "stock"));
  const reserved = toQuantity(readField(lot, "reserved"));
  const locationStatus = readField(lot, "location_status") ?? "located";

  return {
    id: readField(lot, "id"),
    number: readField(lot, "number"),
    expiration_date: toDateOnly(readField(lot, "expiration_date")),
    location_status: locationStatus,
    stock,
    reserved,
    available: locationStatus === "located" ? stock - reserved : 0,
    ...toPickingLocation(lot),
  };
}

/**
 * Builds the public representation of one allocation and its lot.
 * @param {object} allocation - Allocation instance or plain object.
 * @returns {object} Public allocation data.
 */
function toPickingAllocation(allocation) {
  const lot = readField(allocation, "lot");

  return {
    allocation_id: readField(allocation, "id"),
    quantity: toQuantity(readField(allocation, "quantity")),
    status: readField(allocation, "status"),
    lot: lot ? toPickingLot(lot) : null,
  };
}

/**
 * Sorts allocations by the lot expiration date and then the lot id (FEFO).
 * @param {object} left - Allocation instance or plain object.
 * @param {object} right - Allocation instance or plain object.
 * @returns {number} Comparator result.
 */
function compareAllocations(left, right) {
  const leftLot = readField(left, "lot");
  const rightLot = readField(right, "lot");
  const leftDate =
    toDateOnly(leftLot ? readField(leftLot, "expiration_date") : null) ?? "";
  const rightDate =
    toDateOnly(rightLot ? readField(rightLot, "expiration_date") : null) ?? "";

  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  const leftId = Number((leftLot && readField(leftLot, "id")) ?? 0);
  const rightId = Number((rightLot && readField(rightLot, "id")) ?? 0);

  return leftId - rightId;
}

module.exports = {
  compareAllocations,
  toPickingAllocation,
  toPickingLocation,
  toPickingLot,
};
