const Image = require("./image");

describe("Image model", () => {
  it("defines url, reference and thumbnail as required columns", () => {
    const attributes = Image.getAttributes();

    expect(attributes.url.allowNull).toBe(false);
    expect(attributes.url.type.toString()).toBe("VARCHAR(2048)");
    expect(attributes.reference.allowNull).toBe(false);
    expect(attributes.reference.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.reference.unique).toBe(true);
    expect(attributes.thumbnail.allowNull).toBe(false);
    expect(attributes.thumbnail.type.toString()).toBe("VARCHAR(2048)");
  });

  it("defines pathname as an optional column defaulting to null", () => {
    const attributes = Image.getAttributes();

    expect(attributes.pathname.type.toString()).toBe("VARCHAR(2048)");
    expect(attributes.pathname.allowNull).toBe(true);
    expect(attributes.pathname.defaultValue).toBeNull();
  });

  it("uses the documented model and table names", () => {
    expect(Image.name).toBe("Image");
    expect(Image.tableName).toBe("images");
  });
});
