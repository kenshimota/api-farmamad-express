const app = require("./app");
const logger = require("./config/logger");

const port = process.env.PORT || 3001;

app.listen(port, () => {
  logger.info(`API listening on port ${port}`);
});
