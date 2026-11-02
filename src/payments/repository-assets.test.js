const { createAssetOperations } = require("./repository-assets");

/**
 * Builds the model doubles and the asset operations around them.
 * @returns {object} Operations and doubles.
 */
function buildOperations() {
  const model = { count: jest.fn().mockResolvedValue(0) };
  const imageModel = {
    create: jest.fn().mockResolvedValue({ id: 20 }),
    findByPk: jest.fn().mockResolvedValue({ id: 20 }),
  };
  const historyModel = {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    findAll: jest.fn().mockResolvedValue([]),
  };
  const userModel = {};

  return {
    imageModel,
    historyModel,
    model,
    userModel,
    operations: createAssetOperations({
      model,
      imageModel,
      historyModel,
      userModel,
    }),
  };
}

describe("payment asset operations", () => {
  it("creates, finds and removes an image", async () => {
    const { operations, imageModel } = buildOperations();
    const image = { destroy: jest.fn() };

    await expect(
      operations.createImage({ reference: "payment-reference-1" }, "tx"),
    ).resolves.toEqual({ id: 20 });
    await expect(operations.findImage(20, "tx")).resolves.toEqual({ id: 20 });
    await operations.removeImage(image, "tx");

    expect(imageModel.create).toHaveBeenCalledWith(
      { reference: "payment-reference-1" },
      "tx",
    );
    expect(imageModel.findByPk).toHaveBeenCalledWith(20, "tx");
    expect(image.destroy).toHaveBeenCalledWith("tx");
  });

  it("counts the payments that still reference an image", async () => {
    const { operations, model } = buildOperations();

    await expect(operations.countImageReferences(20)).resolves.toBe(0);

    expect(model.count).toHaveBeenCalledWith({
      where: { reference_image_id: 20 },
    });
  });

  it("appends and lists status history events with the actor", async () => {
    const { operations, historyModel, userModel } = buildOperations();

    await operations.createStatusHistory({ payment_id: 1 }, "tx");
    await operations.listStatusHistory(1);

    expect(historyModel.create).toHaveBeenCalledWith({ payment_id: 1 }, "tx");
    expect(historyModel.findAll).toHaveBeenCalledWith({
      where: { payment_id: 1 },
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
      include: [
        {
          model: userModel,
          as: "actor",
          attributes: ["id", "username", "email"],
        },
      ],
    });
  });
});
