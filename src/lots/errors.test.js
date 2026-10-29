const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const {
  handleDeleteError,
  handleWriteError,
  httpError,
  invalidLotId,
  invalidReference,
  isHttpError,
  lotAlreadyExists,
  lotHasStock,
  lotNotFound,
  reservedExceedsStock,
  sectionShelfMismatch,
  shelfWarehouseMismatch,
} = require("./errors");

/**
 * Builds a minimal Express response double.
 * @returns {object} The response double.
 */
function responseDouble() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };

  res.status.mockReturnValue(res);

  return res;
}

describe("lot errors", () => {
  it("builds the documented HTTP errors", () => {
    expect(invalidLotId()).toMatchObject({
      status: 422,
      body: { errors: { id: "Invalid lot id" } },
    });
    expect(lotNotFound()).toMatchObject({
      status: 404,
      body: { message: "Lot not found" },
    });
    expect(lotAlreadyExists()).toMatchObject({
      status: 409,
      body: { message: "Lot already exists" },
    });
    expect(lotHasStock()).toMatchObject({
      status: 409,
      body: { message: "Lot has stock or reservations" },
    });
    expect(reservedExceedsStock()).toMatchObject({
      status: 422,
      body: { errors: { reserved: "reserved cannot exceed stock" } },
    });
    expect(shelfWarehouseMismatch()).toMatchObject({
      status: 422,
      body: {
        errors: { shelf_id: "Shelf does not belong to the warehouse" },
      },
    });
    expect(sectionShelfMismatch()).toMatchObject({
      status: 422,
      body: { errors: { section_id: "Section does not belong to the shelf" } },
    });
    expect(invalidReference("item_state_id")).toMatchObject({
      status: 422,
      body: { errors: { item_state_id: "Invalid item state id" } },
    });
  });

  it("uses a default message when the body has none", () => {
    const error = httpError(418, { errors: { id: "x" } });

    expect(error.message).toBe("Lot error");
    expect(isHttpError(error)).toBe(true);
    expect(isHttpError(new Error("plain"))).toBe(false);
    expect(isHttpError(null)).toBe(false);
  });

  it("sends controlled, duplicated and foreign key write errors", () => {
    const res = responseDouble();

    handleWriteError(lotAlreadyExists(), res);
    expect(res.status).toHaveBeenLastCalledWith(409);
    expect(res.json).toHaveBeenLastCalledWith({
      message: "Lot already exists",
    });

    handleWriteError(new UniqueConstraintError({ message: "dup" }), res);
    expect(res.status).toHaveBeenLastCalledWith(409);

    const withFields = new ForeignKeyConstraintError({ message: "fk" });
    withFields.fields = ["shelf_id"];
    handleWriteError(withFields, res);
    expect(res.status).toHaveBeenLastCalledWith(422);
    expect(res.json).toHaveBeenLastCalledWith({
      errors: { shelf_id: "Invalid shelf id" },
    });
  });

  it("detects a foreign key from an object map or the driver message", () => {
    const res = responseDouble();
    const objectFields = new ForeignKeyConstraintError({ message: "fk" });
    objectFields.fields = { product_id: 1 };
    handleWriteError(objectFields, res);
    expect(res.json).toHaveBeenLastCalledWith({
      errors: { product_id: "Invalid product id" },
    });

    const fromDetail = new ForeignKeyConstraintError({ message: "fk" });
    fromDetail.parent = { detail: "Key (section_id) is not present" };
    handleWriteError(fromDetail, res);
    expect(res.json).toHaveBeenLastCalledWith({
      errors: { section_id: "Invalid section id" },
    });
  });

  it("rethrows unknown write errors", () => {
    expect(() => handleWriteError(new Error("boom"), responseDouble())).toThrow(
      "boom",
    );
  });

  it("handles delete errors", () => {
    const res = responseDouble();

    handleDeleteError(lotHasStock(), res);
    expect(res.status).toHaveBeenLastCalledWith(409);
    expect(res.json).toHaveBeenLastCalledWith({
      message: "Lot has stock or reservations",
    });

    handleDeleteError(new ForeignKeyConstraintError({ message: "fk" }), res);
    expect(res.json).toHaveBeenLastCalledWith({ message: "Lot is in use" });

    expect(() => handleDeleteError(new Error("boom"), res)).toThrow("boom");
  });
});
