const {
  DEFAULT_APP_NAME,
  DEFAULT_APP_URL,
  getProductName,
  getProductUrl,
} = require("./product");

const ORIGINAL_NAME = process.env.APP_NAME;
const ORIGINAL_URL = process.env.APP_URL;

afterEach(() => {
  if (ORIGINAL_NAME === undefined) {
    delete process.env.APP_NAME;
  } else {
    process.env.APP_NAME = ORIGINAL_NAME;
  }

  if (ORIGINAL_URL === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = ORIGINAL_URL;
  }
});

describe("getProductName", () => {
  it("defaults to Farmamed when APP_NAME is undefined", () => {
    delete process.env.APP_NAME;

    expect(DEFAULT_APP_NAME).toBe("Farmamed");
    expect(getProductName()).toBe("Farmamed");
  });

  it("defaults to Farmamed when APP_NAME is empty", () => {
    process.env.APP_NAME = "";

    expect(getProductName()).toBe("Farmamed");
  });

  it("reads the product name from APP_NAME", () => {
    process.env.APP_NAME = "Panadería Central";

    expect(getProductName()).toBe("Panadería Central");
  });
});

describe("getProductUrl", () => {
  it("defaults to the app URL when APP_URL is undefined", () => {
    delete process.env.APP_URL;

    expect(DEFAULT_APP_URL).toBe("https://farmamed.strixcryptoapp.site/app");
    expect(getProductUrl()).toBe("https://farmamed.strixcryptoapp.site/app");
  });

  it("defaults to the app URL when APP_URL is empty", () => {
    process.env.APP_URL = "";

    expect(getProductUrl()).toBe("https://farmamed.strixcryptoapp.site/app");
  });

  it("keeps the configured URL exactly, including the trailing slash", () => {
    process.env.APP_URL = "https://shop.example.com/";

    expect(getProductUrl()).toBe("https://shop.example.com/");
  });

  it("keeps a configured URL that has no trailing slash", () => {
    process.env.APP_URL = "https://shop.example.com";

    expect(getProductUrl()).toBe("https://shop.example.com");
  });
});
