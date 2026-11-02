const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const cors = require("./config/cors");
const requestId = require("./middleware/request-id");
const requestLogger = require("./middleware/request-logger");
const notFound = require("./middleware/not-found");
const errorHandler = require("./middleware/error-handler");
const { getUploadDir } = require("./products/image-config");
const helloRouter = require("./hello");
const healthRouter = require("./health");
const authRouter = require("./auth");
const usersRouter = require("./users");
const rolesRouter = require("./roles");
const customersRouter = require("./customers");
const warehousesRouter = require("./warehouses");
const categoriesRouter = require("./categories");
const imagesRouter = require("./images");
const productsRouter = require("./products");
const statesRouter = require("./states");
const citiesRouter = require("./cities");
const suppliersRouter = require("./suppliers");
const itemStatesRouter = require("./item-states");
const costsRouter = require("./costs");
const stocksRouter = require("./stocks");
const purchasesRouter = require("./purchases");
const currenciesRouter = require("./currencies");
const shelvesRouter = require("./shelves");
const lotsRouter = require("./lots");
const warehouseInboxRouter = require("./warehouse-inbox");
const customerSellersRouter = require("./customer-sellers");
const taxesRouter = require("./taxes");
const methodPaymentTypesRouter = require("./method-payment-types");
const methodPaymentsRouter = require("./method-payments");
const paymentsRouter = require("./payments");
const walletsRouter = require("./wallets");
const priceListsRouter = require("./price-lists");
const invoicesRouter = require("./invoices");
const invoicePaymentsRouter = require("./invoice-payments");
const ordersRouter = require("./orders");
const paymentTermsRouter = require("./payment-terms");
const orderStatusesRouter = require("./order-statuses");
const storeRouter = require("./store");

const app = express();

app.use(requestId);
app.use(requestLogger);
// CORS runs before the JSON parser so preflights are answered without body
// parsing and every response, including parser errors, carries CORS headers.
app.use(cors);
app.use(express.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// Public files uploaded by the API. Disabling indexes and redirects keeps the
// directory from listing its contents.
app.use(
  "/uploads",
  express.static(getUploadDir(), {
    index: false,
    redirect: false,
    dotfiles: "ignore",
  }),
);
app.use("/hello-world", helloRouter);
app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/roles", rolesRouter);
app.use("/customers", customersRouter);
app.use("/warehouses", warehousesRouter);
app.use("/categories", categoriesRouter);
app.use("/images", imagesRouter);
app.use("/products", productsRouter);
app.use("/states", statesRouter);
app.use("/cities", citiesRouter);
app.use("/suppliers", suppliersRouter);
app.use("/item-states", itemStatesRouter);
app.use("/costs", costsRouter);
app.use("/stocks", stocksRouter);
app.use("/purchases", purchasesRouter);
app.use("/currencies", currenciesRouter);
app.use("/shelves", shelvesRouter);
app.use("/lots", lotsRouter);
app.use("/warehouse-inbox", warehouseInboxRouter);
app.use("/customer-sellers", customerSellersRouter);
app.use("/taxes", taxesRouter);
app.use("/method-payment-types", methodPaymentTypesRouter);
app.use("/method-payments", methodPaymentsRouter);
app.use("/payments", paymentsRouter);
app.use("/customer-wallets", walletsRouter);
app.use("/price-lists", priceListsRouter);
app.use("/invoices", invoicePaymentsRouter);
app.use("/invoices", invoicesRouter);
app.use("/orders", ordersRouter);
app.use("/order-statuses", orderStatusesRouter);
app.use("/payment-terms", paymentTermsRouter);
app.use("/store", storeRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
