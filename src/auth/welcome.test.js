const { notifyWelcomeUser } = require("./welcome");

describe("notifyWelcomeUser", () => {
  it("sends the welcome email to the created user", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const log = { error: jest.fn() };

    await notifyWelcomeUser(
      { email: "maria@superking.com", name: "María" },
      {
        send,
        log,
      },
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("maria@superking.com", "María");
    expect(log.error).not.toHaveBeenCalled();
  });

  it("swallows delivery failures and logs them with the recipient email", async () => {
    const error = new Error("connection refused");
    const send = jest.fn().mockRejectedValue(error);
    const log = { error: jest.fn() };

    await expect(
      notifyWelcomeUser(
        { email: "maria@superking.com", name: "María" },
        {
          send,
          log,
        },
      ),
    ).resolves.toBeUndefined();

    expect(log.error).toHaveBeenCalledWith("Could not send the welcome email", {
      email: "maria@superking.com",
      error,
    });
  });

  it("accepts a user without a name", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const log = { error: jest.fn() };

    await notifyWelcomeUser(
      { email: "maria@superking.com", name: null },
      {
        send,
        log,
      },
    );

    expect(send).toHaveBeenCalledWith("maria@superking.com", null);
  });
});
