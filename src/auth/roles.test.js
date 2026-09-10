jest.mock("../models/role", () => ({ findOne: jest.fn() }));

const Role = require("../models/role");
const {
  DEFAULT_ROLE,
  ADMIN_ROLE,
  findRoleByName,
  isValidRole,
} = require("./roles");

beforeEach(() => {
  Role.findOne.mockReset();
});

describe("role helpers", () => {
  it("exposes the default and administrator role names", () => {
    expect(DEFAULT_ROLE).toBe("customer");
    expect(ADMIN_ROLE).toBe("admin");
  });

  it("looks roles up by name in the roles table", async () => {
    const role = { id: 2, name: "seller" };
    Role.findOne.mockResolvedValue(role);

    await expect(findRoleByName("seller")).resolves.toBe(role);
    expect(Role.findOne).toHaveBeenCalledWith({ where: { name: "seller" } });
  });

  it("forwards extra query options such as a transaction", async () => {
    Role.findOne.mockResolvedValue(null);
    const transaction = { id: "tx" };

    await findRoleByName("admin", { transaction });

    expect(Role.findOne).toHaveBeenCalledWith({
      where: { name: "admin" },
      transaction,
    });
  });

  it("validates a role against the roles table", async () => {
    Role.findOne.mockResolvedValueOnce({ id: 1, name: "customer" });
    await expect(isValidRole("customer")).resolves.toBe(true);

    Role.findOne.mockResolvedValueOnce(null);
    await expect(isValidRole("does-not-exist")).resolves.toBe(false);
  });
});
