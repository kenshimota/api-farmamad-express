# API Bread King

REST API de Bread King construida con Express 5, Sequelize 6 y PostgreSQL.

## Puesta en marcha

```bash
npm install
docker-compose up -d db
npm run db:migrate
npm run db:seed
npm start
```

La documentación interactiva (Swagger UI) está disponible en
`http://localhost:3001/docs`.

Variables de entorno relevantes: `PORT`, `NODE_ENV`, `LOG_LEVEL`, `NO_COLOR`,
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`,
`JWT_EXPIRES_IN`, `GMAIL_USERNAME` y `GMAIL_TOKEN` (ver `.env.example`).

## Autenticación

Los endpoints protegidos esperan el header `Authorization: Bearer <jwt>`. El
token se obtiene en `POST /auth/login` e incluye el `role` del usuario en su
payload. Si el token falta, es inválido o está expirado, la API responde `401`
con `{ "message": "Unauthorized" }`.

## Roles

Los roles viven en la tabla `roles` (no son un ENUM de Postgres) y se cargan
con el seeder idempotente `seeders/20260910000001-roles.js`:

| Rol                  | Uso                                                    |
| -------------------- | ------------------------------------------------------ |
| `admin`              | Administra el sistema; único que puede crear usuarios. |
| `seller`             | Gestiona ventas y pedidos.                             |
| `delivery`           | Repartidor de la empresa.                              |
| `freelance_delivery` | Repartidor independiente.                              |
| `customer`           | Usuario final.                                         |

## Endpoints

### `GET /hello-world`

Público. Devuelve un mensaje de saludo de prueba.

```bash
curl http://localhost:3001/hello-world
```

Respuesta `200`:

```json
{ "message": "Hello World" }
```

### `GET /health`

Público. Reporta la salud de la API y de la base de datos.

```bash
curl http://localhost:3001/health
```

Respuesta `200`:

```json
{ "status": "ok", "database": "up" }
```

Respuesta `503` (base de datos inaccesible):

```json
{ "status": "error", "database": "down" }
```

### `GET /auth/setup-status`

Público. Indica si el sistema ya tiene al menos un admin, para decidir
si se debe mostrar el formulario de registro inicial.

```bash
curl http://localhost:3001/auth/setup-status
```

```json
{ "hasAdmin": false }
```

### `POST /auth/register-admin`

Público. Registra al admin inicial. Solo funciona si todavía no existe
ningún admin; en caso contrario responde `409`. El rol del usuario
creado es siempre `admin`.

Campos: `username`, `email`, `password` (mínimo 8 caracteres, requeridos) y
`name` (opcional).

```bash
curl -X POST http://localhost:3001/auth/register-admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@breadking.com","password":"secreto123","name":"Administrador"}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@breadking.com",
  "name": "Administrador",
  "role": "admin"
}
```

Errores:

| Código | Cuerpo                                                       |
| ------ | ------------------------------------------------------------ |
| `400`  | `{ "message": "username, email and password are required" }` |
| `409`  | `{ "message": "Admin already exists" }`                      |
| `422`  | `{ "errors": { "email": "Invalid email" } }`                 |

### `POST /auth/login`

Público. Autentica con `identifier` (email o username) y `password`.

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@breadking.com","password":"secreto123"}'
```

Respuesta `200`:

```json
{
  "token": "<jwt>",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@breadking.com",
    "name": "Administrador",
    "role": "admin"
  }
}
```

### `GET /auth/me`

Protegido. Devuelve los datos públicos del usuario autenticado, incluido su
`role`.

```bash
curl http://localhost:3001/auth/me -H "Authorization: Bearer <jwt>"
```

### `POST /auth/forgot-password`

Público. Envía un código de recuperación de 8 dígitos al email si la cuenta
existe. La respuesta es siempre la misma para no revelar qué emails están
registrados; si el email no existe no se envía correo. Solo se puede pedir un
código nuevo cada 2 minutos (si no, responde `429`).

```bash
curl -X POST http://localhost:3001/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@example.com"}'
```

Respuesta `200` (exista o no el email):

```json
{ "message": "If the email exists, a recovery code was sent" }
```

Errores:

| Código | Cuerpo                                                      |
| ------ | ----------------------------------------------------------- |
| `400`  | `{ "message": "email is required" }`                        |
| `422`  | `{ "errors": { "email": "Email inválido" } }`               |
| `429`  | `{ "message": "Please wait before requesting a new code" }` |
| `502`  | `{ "message": "Could not send the recovery email" }`        |

### `POST /auth/verify-reset-code`

Público. Valida el código de 8 dígitos (válido 5 minutos, un solo uso) y
devuelve un JWT con los datos públicos del usuario, de modo que la sesión queda
iniciada.

```bash
curl -X POST http://localhost:3001/auth/verify-reset-code \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@example.com","code":"00427193"}'
```

Respuesta `200`:

```json
{
  "token": "<jwt>",
  "user": {
    "id": 1,
    "username": "juan",
    "email": "juan@example.com",
    "name": "Juan",
    "role": "customer"
  }
}
```

Errores:

| Código | Cuerpo                                                       |
| ------ | ------------------------------------------------------------ |
| `400`  | `{ "message": "email and code are required" }`               |
| `401`  | `{ "message": "Invalid or expired code" }`                   |
| `422`  | `{ "errors": { "code": "El código debe tener 8 dígitos" } }` |

### `POST /auth/reset-password`

Protegido: requiere `Authorization: Bearer <jwt>` (el de
`POST /auth/verify-reset-code` o el de `POST /auth/login`). Cambia la
contraseña del usuario autenticado e invalida todos los códigos de recuperación
pendientes. La contraseña nunca viaja en la respuesta: se guarda como hash
bcrypt.

Campos: `password` (mínimo 8 caracteres) y `passwordConfirmation`, ambos
requeridos y con el mismo valor.

```bash
curl -X POST http://localhost:3001/auth/reset-password \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"password":"nuevaClave123","passwordConfirmation":"nuevaClave123"}'
```

Respuesta `200`:

```json
{ "message": "Password updated" }
```

Errores:

| Código | Cuerpo                                                               |
| ------ | -------------------------------------------------------------------- |
| `400`  | `{ "message": "password and passwordConfirmation are required" }`    |
| `401`  | `{ "message": "Unauthorized" }`                                      |
| `422`  | `{ "errors": { "passwordConfirmation": "Passwords do not match" } }` |

Los correos se envían con Nodemailer a través de Gmail: configura
`GMAIL_USERNAME` (cuenta remitente) y `GMAIL_TOKEN` (App Password de 16
caracteres, nunca la contraseña normal de la cuenta).

### `POST /users`

Protegido: requiere un JWT con rol `admin`. Crea un usuario con
cualquiera de los roles existentes en la tabla `roles`.

Campos: `username`, `email`, `password` (mínimo 8 caracteres) y `role`
(requeridos); `name` (opcional). Si `username` o `email` ya existen responde
`409`; si el rol no existe responde `422`.

```bash
curl -X POST http://localhost:3001/users \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"username":"maria","email":"maria@breadking.com","password":"secreto123","name":"María","role":"seller"}'
```

Respuesta `201`:

```json
{
  "id": 2,
  "username": "maria",
  "email": "maria@breadking.com",
  "name": "María",
  "role": "seller"
}
```

Errores:

| Código | Cuerpo                                                             |
| ------ | ------------------------------------------------------------------ |
| `400`  | `{ "message": "username, email, password and role are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                                    |
| `403`  | `{ "message": "Forbidden" }`                                       |
| `409`  | `{ "message": "User already exists" }`                             |
| `422`  | `{ "errors": { "role": "Invalid role" } }`                         |

En ningún caso la contraseña viaja en las respuestas: se guarda como hash
bcrypt.

## Logs y manejo de errores

La API escribe logs en stdout/stderr con timestamp ISO, nivel (`INFO`, `WARN`,
`ERROR`) y contexto. El nivel se resalta con color ANSI cuando la salida es una
terminal interactiva; en CI/Docker o cuando `NO_COLOR` está definido se imprime
texto plano. `LOG_LEVEL` define el nivel mínimo impreso (`info` por defecto,
`warn` o `error` para reducir ruido). El logger nunca imprime contraseñas,
tokens, cookies ni códigos de recuperación: esos valores se reemplazan por
`[REDACTED]`.

Ejemplo de log de acceso:

```text
2026-09-13T10:15:31.002Z INFO 200 GET /health requestId=8a2d...
```

Cada petición recibe un `X-Request-Id` (el enviado por el cliente o un UUID
generado) que aparece en los logs y en la cabecera `X-Request-Id` de la
respuesta. Todas las respuestas de error son JSON:

| Código | Cuerpo                                   | Cuándo                      |
| ------ | ---------------------------------------- | --------------------------- |
| `400`  | `{ "message": "Invalid JSON body" }`     | cuerpo con JSON malformado  |
| `404`  | `{ "message": "Not found" }`             | ruta inexistente            |
| `500`  | `{ "message": "Internal server error" }` | error interno no controlado |

El detalle real del `500` (mensaje y stack) se escribe **solo** en los logs,
junto al método, la ruta y el `requestId`. Con `NODE_ENV=development` la
respuesta `500` añade un campo opcional `debug` con el mensaje del error; en
`production` nunca se incluye.

## Tests

```bash
npm test                 # unitarios (sin base de datos)
npm run test:coverage    # unitarios + cobertura
npm run test:integration # contra Postgres real (requiere docker-compose up -d db)
```
