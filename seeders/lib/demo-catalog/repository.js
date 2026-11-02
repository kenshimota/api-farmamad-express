/**
 * Barrel module that keeps the seeder imports stable while the implementation
 * is split by responsibility (helpers, location and catalog rows).
 */
module.exports = {
  ...require("./helpers"),
  ...require("./location"),
  ...require("./catalog-rows"),
};
