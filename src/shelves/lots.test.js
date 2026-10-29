const { Op } = require("sequelize");

jest.mock(
  "../models/lot",
  () => ({
    count: jest.fn(),
    getAttributes: jest.fn(),
  }),
  { virtual: true },
);

const Lot = require("../models/lot");
const { countSectionLots, countShelfLots, loadLotModel } = require("./lots");

beforeEach(() => {
  Lot.count.mockReset();
  Lot.getAttributes.mockReset();
});

describe("lots helper", () => {
  it("exposes the Lot model when it exists", () => {
    expect(loadLotModel()).toBe(Lot);
  });

  it("counts the lots linked to the shelf", async () => {
    Lot.getAttributes.mockReturnValue({ shelf_id: {}, code: {} });
    Lot.count.mockResolvedValue(2);

    await expect(countShelfLots(1, [])).resolves.toBe(2);
    expect(Lot.count).toHaveBeenCalledWith({
      where: { [Op.or]: [{ shelf_id: 1 }] },
    });
  });

  it("also counts the lots linked to the shelf sections", async () => {
    Lot.getAttributes.mockReturnValue({ shelf_id: {}, shelf_section_id: {} });
    Lot.count.mockResolvedValueOnce(1).mockResolvedValueOnce(3);

    await expect(countShelfLots(1, [2, 3])).resolves.toBe(4);
    expect(Lot.count).toHaveBeenNthCalledWith(1, {
      where: { [Op.or]: [{ shelf_id: 1 }] },
    });
    expect(Lot.count).toHaveBeenNthCalledWith(2, {
      where: {
        [Op.or]: [{ shelf_section_id: { [Op.in]: [2, 3] } }],
      },
    });
  });

  it("returns 0 when the Lot model has no usable columns", async () => {
    Lot.getAttributes.mockReturnValue({ id: {} });

    await expect(countShelfLots(1, [2])).resolves.toBe(0);
    await expect(countSectionLots(2)).resolves.toBe(0);
    expect(Lot.count).not.toHaveBeenCalled();
  });

  it("counts the lots linked to one section", async () => {
    Lot.getAttributes.mockReturnValue({
      section_id: {},
      shelf_section_id: {},
    });
    Lot.count.mockResolvedValue(1);

    await expect(countSectionLots(2)).resolves.toBe(1);
    expect(Lot.count).toHaveBeenCalledWith({
      where: {
        [Op.or]: [{ shelf_section_id: 2 }, { section_id: 2 }],
      },
    });
  });
});
