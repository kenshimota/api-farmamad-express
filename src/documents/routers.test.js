process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("./quotation", () => ({
  quotationService: { getQuotation: jest.fn() },
}));
jest.mock("./invoice", () => ({
  invoiceDocumentService: { getInvoiceDocument: jest.fn() },
}));
jest.mock("./pdf", () => ({
  renderQuotationPdf: jest.fn(),
  renderInvoicePdf: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { quotationService } = require("./quotation");
const { invoiceDocumentService } = require("./invoice");
const { renderInvoicePdf, renderQuotationPdf } = require("./pdf");
const quotationRouter = require("./quotation-router");
const invoiceRouter = require("./invoice-router");

const SECRET = "test-secret";
const PDF = Buffer.from("%PDF-1.7 fake document");
const QUOTATION = {
  order: { id: 10, number: 10, status: "generate" },
  target_currency: { id: 1, code: "VES" },
};
const INVOICE = { invoice: { id: 7, number: 7 } };

const app = express();
app.use(express.json());
app.use("/orders", quotationRouter);
app.use("/invoices", invoiceRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Internal server error" });
});

/**
 * Signs a JWT for the given role.
 * @param {string} [role] - Role embedded in the token.
 * @returns {string} Signed JWT.
 */
function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "ana", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Sends an authenticated request.
 * @param {string} path - Request path.
 * @param {string} [token] - Bearer token; null omits the header.
 * @returns {import("supertest").Test} The request.
 */
function get(path, token = tokenFor()) {
  const req = request(app).get(path);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  process.env.APP_NAME = "Farmamed";
  process.env.COMPANY_TAX_ID = "J-12345678-9";
  process.env.COMPANY_ADDRESS = "Av. Monseñor Rivero 123";
  delete process.env.COMPANY_LOGO_PATH;
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue({ id: 1, isBlocked: false });
  quotationService.getQuotation.mockReset();
  quotationService.getQuotation.mockResolvedValue(QUOTATION);
  invoiceDocumentService.getInvoiceDocument.mockReset();
  invoiceDocumentService.getInvoiceDocument.mockResolvedValue(INVOICE);
  renderQuotationPdf.mockReset();
  renderQuotationPdf.mockResolvedValue(PDF);
  renderInvoicePdf.mockReset();
  renderInvoicePdf.mockResolvedValue(PDF);
});

describe("GET /orders/:id/quotation", () => {
  it("responds 401 without a token", async () => {
    const response = await get("/orders/10/quotation", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await get("/orders/10/quotation", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(quotationService.getQuotation).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["/orders/abc/quotation", { errors: { id: "Invalid order id" } }],
    [
      "/orders/10/quotation?download=maybe",
      { errors: { download: "Invalid download" } },
    ],
    [
      "/orders/10/quotation?currency_id=x",
      { errors: { currency_id: "Invalid currency" } },
    ],
  ])("responds 422 for %s", async (path, body) => {
    const response = await get(path);

    expect(response.status).toBe(422);
    expect(response.body).toEqual(body);
  });

  it("returns the PDF inline with the cache-safe headers", async () => {
    const response = await get("/orders/10/quotation");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toBe(
      'inline; filename="cotizacion-pedido-10-VES.pdf"',
    );
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.from(response.body).subarray(0, 5).toString()).toBe("%PDF-");
    expect(quotationService.getQuotation).toHaveBeenCalledWith(
      10,
      expect.any(Object),
      { currencyId: undefined },
    );
  });

  it("forces an attachment with download=true", async () => {
    const response = await get("/orders/10/quotation?download=true");

    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toBe(
      'attachment; filename="cotizacion-pedido-10-VES.pdf"',
    );
  });

  it("forwards controlled service errors", async () => {
    quotationService.getQuotation.mockRejectedValue({
      status: 409,
      body: { message: "Order is already invoiced" },
    });

    const response = await get("/orders/10/quotation");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Order is already invoiced" });
  });

  it("responds 503 when the company profile is missing", async () => {
    delete process.env.COMPANY_TAX_ID;

    const response = await get("/orders/10/quotation");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      message: "Company profile is not configured",
    });
    expect(quotationService.getQuotation).not.toHaveBeenCalled();
  });
});

describe("GET /invoices/:id/pdf", () => {
  it("responds 401 without a token", async () => {
    const response = await get("/invoices/7/pdf", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await get("/invoices/7/pdf", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(invoiceDocumentService.getInvoiceDocument).not.toHaveBeenCalled();
    },
  );

  it("responds 422 for an invalid id", async () => {
    const response = await get("/invoices/abc/pdf");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid invoice id" } });
  });

  it("returns the invoice PDF inline", async () => {
    const response = await get("/invoices/7/pdf");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toBe(
      'inline; filename="factura-7.pdf"',
    );
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.from(response.body).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("forces an attachment with download=true", async () => {
    const response = await get("/invoices/7/pdf?download=true");

    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toBe(
      'attachment; filename="factura-7.pdf"',
    );
  });

  it("rejects an invalid download flag", async () => {
    const response = await get("/invoices/7/pdf?download=si");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { download: "Invalid download" } });
  });

  it("responds 503 when the company profile is missing", async () => {
    delete process.env.COMPANY_ADDRESS;

    const response = await get("/invoices/7/pdf");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      message: "Company profile is not configured",
    });
  });

  it("forwards controlled service errors", async () => {
    invoiceDocumentService.getInvoiceDocument.mockRejectedValue({
      status: 404,
      body: { message: "Invoice not found" },
    });

    const response = await get("/invoices/7/pdf");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Invoice not found" });
  });
});
