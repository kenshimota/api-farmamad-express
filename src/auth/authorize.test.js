const { authorize } = require("./authorize");

/**
 * Builds a minimal Express response double.
 * @returns {object} Response mock with chainable status/json.
 */
function createResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("authorize", () => {
  it("calls next when the user has the allowed role", () => {
    const req = { user: { role: "admin" } };
    const res = createResponse();
    const next = jest.fn();

    authorize("admin")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each(["seller", "dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 when the user role is %s",
    (role) => {
      const req = { user: { role } };
      const res = createResponse();
      const next = jest.fn();

      authorize("admin")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Forbidden" });
      expect(next).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when there is no authenticated user", () => {
    const res = createResponse();
    const next = jest.fn();

    authorize("admin")({}, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
  });

  it("responds 403 when the token has no role", () => {
    const res = createResponse();
    const next = jest.fn();

    authorize("admin")({ user: { sub: 1 } }, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
