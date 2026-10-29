const { toPublicImage } = require("./serializer");

const IMAGE = {
  id: 1,
  url: "https://cdn.farmamad.com/products/ibuprofeno.png",
  pathname: "/uploads/products/ibuprofeno.png",
  reference: "ibuprofeno-400",
  thumbnail: "https://cdn.farmamad.com/products/ibuprofeno-thumb.png",
};

describe("toPublicImage", () => {
  it("reads the fields directly from a plain object", () => {
    expect(toPublicImage(IMAGE)).toEqual(IMAGE);
  });

  it("prefers the get() accessor over direct properties", () => {
    const values = {
      ...IMAGE,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    const image = {
      get: jest.fn((field) => values[field]),
      id: 999,
      url: "wrong",
    };

    expect(toPublicImage(image)).toEqual(IMAGE);
    expect(image.get).toHaveBeenCalledWith("id");
  });

  it("exposes only id, url, pathname, reference and thumbnail in order", () => {
    expect(Object.keys(toPublicImage(IMAGE))).toEqual([
      "id",
      "url",
      "pathname",
      "reference",
      "thumbnail",
    ]);
  });

  it("keeps a null pathname", () => {
    expect(toPublicImage({ ...IMAGE, pathname: null }).pathname).toBeNull();
  });
});
