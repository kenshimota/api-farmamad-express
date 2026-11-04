const { isHttpError } = require("../shared/http-error");
const { DEFAULT_COMPANY_NAME, loadCompanyProfile } = require("./company");

const ENV = Object.freeze({
  APP_NAME: "Farmamed",
  COMPANY_TAX_ID: "J-12345678-9",
  COMPANY_ADDRESS: "Av. Monseñor Rivero 123",
  COMPANY_PHONE: "+58 212 555-1234",
  COMPANY_EMAIL: "hola@farmamed.com",
});

/**
 * Builds a fake logger.
 * @returns {{ warn: Function }} The logger double.
 */
function loggerDouble() {
  return { warn: jest.fn() };
}

describe("company profile", () => {
  it("reads the emitter data from the environment", () => {
    const profile = loadCompanyProfile({ env: ENV, logger: loggerDouble() });

    expect(profile).toEqual({
      name: "Farmamed",
      taxId: "J-12345678-9",
      address: "Av. Monseñor Rivero 123",
      phone: "+58 212 555-1234",
      email: "hola@farmamed.com",
      logo: null,
    });
  });

  it("defaults the visible name to Farmamed", () => {
    const profile = loadCompanyProfile({
      env: { ...ENV, APP_NAME: "   " },
      logger: loggerDouble(),
    });

    expect(profile.name).toBe(DEFAULT_COMPANY_NAME);
  });

  it.each(["COMPANY_TAX_ID", "COMPANY_ADDRESS"])(
    "rejects a missing %s with a 503",
    (key) => {
      const env = { ...ENV, [key]: "" };

      try {
        loadCompanyProfile({ env, logger: loggerDouble() });
        throw new Error("expected a company profile error");
      } catch (error) {
        expect(isHttpError(error)).toBe(true);
        expect(error.status).toBe(503);
        expect(error.body).toEqual({
          message: "Company profile is not configured",
        });
      }
    },
  );

  it("loads the configured logo", () => {
    const readFile = jest.fn(() => Buffer.from("logo"));

    const profile = loadCompanyProfile({
      env: { ...ENV, COMPANY_LOGO_PATH: "/tmp/logo.png" },
      readFile,
      logger: loggerDouble(),
    });

    expect(readFile).toHaveBeenCalledWith("/tmp/logo.png");
    expect(profile.logo).toEqual(Buffer.from("logo"));
  });

  it("keeps working without the logo and logs a warning when it fails", () => {
    const logger = loggerDouble();
    const readFile = jest.fn(() => {
      throw new Error("missing");
    });

    const profile = loadCompanyProfile({
      env: { ...ENV, COMPANY_LOGO_PATH: "/tmp/logo.png" },
      readFile,
      logger,
    });

    expect(profile.logo).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("logo"),
      expect.objectContaining({ path: "/tmp/logo.png" }),
    );
  });
});
