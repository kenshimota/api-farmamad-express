const { toPublicOrderStatus } = require("./serializer");

describe("order status serializer", () => {
  it("computes is_terminal from next_status_code", () => {
    expect(
      toPublicOrderStatus({
        id: 1,
        code: "draft",
        name: "Borrador",
        description: null,
        sort_order: 10,
        next_status_code: "request",
        is_system: true,
      }),
    ).toEqual({
      id: 1,
      code: "draft",
      name: "Borrador",
      description: null,
      sort_order: 10,
      next_status_code: "request",
      is_terminal: false,
      is_system: true,
    });

    expect(
      toPublicOrderStatus({
        id: 4,
        code: "invoiced",
        name: "Facturado",
        description: null,
        sort_order: 40,
        next_status_code: null,
        is_system: true,
      }).is_terminal,
    ).toBe(true);
  });
});
