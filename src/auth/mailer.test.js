jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

const nodemailer = require("nodemailer");
const {
  MailDeliveryError,
  getTransport,
  setTransport,
  resetTransport,
  sendRecoveryCode,
  sendWelcomeEmail,
} = require("./mailer");

const CODE = "00427193";
const USERNAME = "sender@gmail.com";
const TOKEN = "app-password";
const DEFAULT_URL = "https://dashboard.asic-guanipa.online/";

beforeEach(() => {
  process.env.GMAIL_USERNAME = USERNAME;
  process.env.GMAIL_TOKEN = TOKEN;
  delete process.env.APP_NAME;
  delete process.env.APP_URL;
  resetTransport();
});

afterAll(() => {
  delete process.env.GMAIL_USERNAME;
  delete process.env.GMAIL_TOKEN;
  delete process.env.APP_NAME;
  delete process.env.APP_URL;
});

describe("getTransport", () => {
  it("builds a Gmail transport lazily from the environment variables", () => {
    const transport = { sendMail: jest.fn() };
    nodemailer.createTransport.mockReturnValue(transport);

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(getTransport()).toBe(transport);
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      service: "gmail",
      auth: { user: USERNAME, pass: TOKEN },
    });
    expect(getTransport()).toBe(transport);
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
  });

  it("uses an injected transport instead of creating a new one", () => {
    const transport = { sendMail: jest.fn() };
    setTransport(transport);

    expect(getTransport()).toBe(transport);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it("discards the injected transport when it is reset", () => {
    const injected = { sendMail: jest.fn() };
    const created = { sendMail: jest.fn() };
    setTransport(injected);
    nodemailer.createTransport.mockReturnValue(created);

    resetTransport();

    expect(getTransport()).toBe(created);
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
  });
});

describe("MailDeliveryError", () => {
  it("keeps the original cause optional", () => {
    const error = new MailDeliveryError("boom");

    expect(error.name).toBe("MailDeliveryError");
    expect(error.cause).toBeUndefined();
  });

  it("keeps the original error as the cause", () => {
    const cause = new Error("smtp down");
    const error = new MailDeliveryError("boom", cause);

    expect(error.cause).toBe(cause);
  });
});

describe("sendRecoveryCode", () => {
  it("sends a Spanish email with the code and its 5 minute validity", async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: "1" });
    setTransport({ sendMail });

    await sendRecoveryCode("juan@example.com", CODE);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const message = sendMail.mock.calls[0][0];
    expect(message.from).toBe(USERNAME);
    expect(message.to).toBe("juan@example.com");
    expect(message.subject).toBe("Recuperación de contraseña - Super King");
    expect(message.text).toBe(
      [
        "Hola,",
        "",
        "Recibimos una solicitud para restablecer tu contraseña en Super King.",
        `Tu código de recuperación es: ${CODE}`,
        "",
        "El código es válido durante 5 minutos. Si no solicitaste este cambio, " +
          "ignora este correo.",
        "",
        "Equipo Super King",
      ].join("\n"),
    );
  });

  it("uses the configured product name in the recovery email", async () => {
    process.env.APP_NAME = "Panadería Central";
    const sendMail = jest.fn().mockResolvedValue({ messageId: "1" });
    setTransport({ sendMail });

    await sendRecoveryCode("juan@example.com", CODE);

    const { subject, text } = sendMail.mock.calls[0][0];
    expect(subject).toBe("Recuperación de contraseña - Panadería Central");
    expect(text).toContain("restablecer tu contraseña en Panadería Central.");
    expect(text).toContain("Equipo Panadería Central");
  });

  it("wraps delivery failures in a MailDeliveryError", async () => {
    const cause = new Error("smtp down");
    setTransport({ sendMail: jest.fn().mockRejectedValue(cause) });

    const promise = sendRecoveryCode("juan@example.com", CODE);

    await expect(promise).rejects.toBeInstanceOf(MailDeliveryError);
    await expect(promise).rejects.toThrow("Could not send the recovery email");
  });
});

describe("sendWelcomeEmail", () => {
  it("sends a plain text Spanish welcome email to the new user", async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: "1" });
    setTransport({ sendMail });

    await sendWelcomeEmail("maria@superking.com", "María");

    expect(sendMail).toHaveBeenCalledTimes(1);
    const message = sendMail.mock.calls[0][0];
    expect(message.from).toBe(USERNAME);
    expect(message.to).toBe("maria@superking.com");
    expect(message.subject).toBe("¡Bienvenido a Super King!");
    expect(message.text).toBe(
      [
        "Hola María,",
        "",
        "¡Te damos la bienvenida a Super King!",
        "",
        "Ya puedes ingresar a la web desde:",
        DEFAULT_URL,
        "",
        "Si no creaste esta cuenta, ignora este correo.",
        "",
        "Equipo Super King",
      ].join("\n"),
    );
  });

  it("uses a generic greeting when the user has no name", async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: "1" });
    setTransport({ sendMail });

    await sendWelcomeEmail("maria@superking.com", null);

    const { text } = sendMail.mock.calls[0][0];
    expect(text.startsWith("Hola,\n")).toBe(true);
    expect(text).not.toContain("Hola null");
  });

  it("uses the configured product name and URL", async () => {
    process.env.APP_NAME = "Panadería Central";
    process.env.APP_URL = "https://panaderia.example.com/";
    const sendMail = jest.fn().mockResolvedValue({ messageId: "1" });
    setTransport({ sendMail });

    await sendWelcomeEmail("maria@superking.com", "María");

    const { subject, text } = sendMail.mock.calls[0][0];
    expect(subject).toBe("¡Bienvenido a Panadería Central!");
    expect(text).toContain("¡Te damos la bienvenida a Panadería Central!");
    expect(text).toContain("https://panaderia.example.com/");
    expect(text).toContain("Equipo Panadería Central");
  });

  it("wraps delivery failures in a MailDeliveryError", async () => {
    const cause = new Error("smtp down");
    setTransport({ sendMail: jest.fn().mockRejectedValue(cause) });

    const promise = sendWelcomeEmail("maria@superking.com", "María");

    await expect(promise).rejects.toBeInstanceOf(MailDeliveryError);
    await expect(promise).rejects.toThrow("Could not send the welcome email");
  });
});
