/**
 * Plain-text, Spanish email bodies sent by the product.
 *
 * Rendering is kept free of transport details so the mailer only deals with
 * delivery. Each builder receives the already resolved product name and URL.
 */

/**
 * Builds the recovery email body.
 * @param {string} code - Plain 8-digit recovery code.
 * @param {string} productName - Resolved product name for this send.
 * @returns {string} The email text.
 */
function buildRecoveryBody(code, productName) {
  return [
    "Hola,",
    "",
    `Recibimos una solicitud para restablecer tu contraseña en ${productName}.`,
    `Tu código de recuperación es: ${code}`,
    "",
    "El código es válido durante 5 minutos. Si no solicitaste este cambio, " +
      "ignora este correo.",
    "",
    `Equipo ${productName}`,
  ].join("\n");
}

/**
 * Builds the welcome email body.
 * @param {string|null|undefined} name - User name, used in the greeting.
 * @param {string} productName - Resolved product name for this send.
 * @param {string} productUrl - Resolved web link for this send.
 * @returns {string} The email text.
 */
function buildWelcomeBody(name, productName, productUrl) {
  const greeting = name ? `Hola ${name},` : "Hola,";

  return [
    greeting,
    "",
    `¡Te damos la bienvenida a ${productName}!`,
    "",
    "Ya puedes ingresar a la web desde:",
    productUrl,
    "",
    "Si no creaste esta cuenta, ignora este correo.",
    "",
    `Equipo ${productName}`,
  ].join("\n");
}

module.exports = { buildRecoveryBody, buildWelcomeBody };
