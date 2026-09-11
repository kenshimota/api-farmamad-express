const nodemailer = require("nodemailer");

/**
 * Error thrown when the recovery email cannot be delivered.
 */
class MailDeliveryError extends Error {
  /**
   * @param {string} message - Error description.
   * @param {Error} [cause] - Original nodemailer error.
   */
  constructor(message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "MailDeliveryError";
  }
}

let transport = null;

/**
 * Builds the Gmail transport lazily using GMAIL_USERNAME and GMAIL_TOKEN.
 * @returns {import("nodemailer").Transporter} The configured transport.
 */
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USERNAME,
        pass: process.env.GMAIL_TOKEN,
      },
    });
  }

  return transport;
}

/**
 * Replaces the transport; used by tests to avoid real SMTP traffic.
 * @param {object} next - Transport replacement.
 * @returns {void}
 */
function setTransport(next) {
  transport = next;
}

/**
 * Discards the current transport so the next send builds a new one.
 * @returns {void}
 */
function resetTransport() {
  transport = null;
}

/**
 * Builds the Spanish recovery email body.
 * @param {string} code - Plain 8-digit recovery code.
 * @returns {string} The email text.
 */
function buildBody(code) {
  return [
    "Hola,",
    "",
    "Recibimos una solicitud para restablecer tu contraseña en Bread King.",
    `Tu código de recuperación es: ${code}`,
    "",
    "El código es válido durante 5 minutos. Si no solicitaste este cambio, " +
      "ignora este correo.",
    "",
    "Equipo Bread King",
  ].join("\n");
}

/**
 * Sends the recovery code to the given email through Gmail.
 * @param {string} email - Recipient address.
 * @param {string} code - Plain 8-digit recovery code.
 * @returns {Promise<void>}
 * @throws {MailDeliveryError} When the transport cannot deliver the message.
 */
async function sendRecoveryCode(email, code) {
  try {
    await getTransport().sendMail({
      from: process.env.GMAIL_USERNAME,
      to: email,
      subject: "Recuperación de contraseña - Bread King",
      text: buildBody(code),
    });
  } catch (error) {
    throw new MailDeliveryError("Could not send the recovery email", error);
  }
}

module.exports = {
  MailDeliveryError,
  getTransport,
  setTransport,
  resetTransport,
  sendRecoveryCode,
};
