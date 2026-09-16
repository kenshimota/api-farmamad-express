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
`JWT_EXPIRES_IN`, `CORS_ORIGIN`, `GMAIL_USERNAME` y `GMAIL_TOKEN` (ver
`.env.example`).

## Autenticación

Los endpoints protegidos esperan el header `Authorization: Bearer <jwt>`. El
token se obtiene en `POST /auth/login` e incluye el `role` del usuario en su
payload. Si el token falta, es inválido o está expirado, la API responde `401`
con `{ "message": "Unauthorized" }`.

## CORS

La API responde con cabeceras CORS en **todas** las respuestas (éxito y error),
incluidas las que producen el manejador de rutas inexistentes y el de errores.
Por defecto se permite cualquier origen:

```http
Access-Control-Allow-Origin: *
Access-Control-Expose-Headers: X-Request-Id
```

Las peticiones preflight (`OPTIONS`) a una ruta existente se responden sin
llegar a los routers de negocio ni consultar la base de datos:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,X-Request-Id
Access-Control-Max-Age: 86400
```

Un `OPTIONS` a una ruta inexistente sigue respondiendo `404`
(`{ "message": "Not found" }`), también con las cabeceras CORS. La cabecera
`X-Request-Id` se expone con `Access-Control-Expose-Headers` para que el
navegador pueda leerla; no se exponen `Authorization` ni `Set-Cookie`. La API
no habilita `Access-Control-Allow-Credentials`: la autenticación es con
`Authorization: Bearer`, no con cookies.

El valor `*` es una **decisión temporal**: cuando exista la lista definitiva de
dominios, define `CORS_ORIGIN` con los orígenes permitidos separados por comas
y solo esos orígenes recibirán la cabecera con su propio valor (más
`Vary: Origin`); las peticiones sin `Origin` no reciben la cabecera.

```bash
CORS_ORIGIN=https://app.breadking.com,https://admin.breadking.com
```

Si `CORS_ORIGIN` no está definida o está vacía, se permite cualquier origen.

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
    "role": "admin",
    "isBlocked": false
  }
}
```

Errores:

| Código | Cuerpo                                 |
| ------ | -------------------------------------- |
| `401`  | `{ "message": "Invalid credentials" }` |
| `403`  | `{ "message": "User is blocked" }`     |
| `422`  | `{ "errors": { "password": "..." } }`  |

La comprobación de bloqueo ocurre **después** de validar las credenciales: si la
cuenta está bloqueada la API responde `403` con `{ "message": "User is blocked" }`
en lugar del `401` genérico, para que el usuario sepa que su cuenta está
suspendida. El mensaje nunca se emite para credenciales inválidas.

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
| `403`  | `{ "message": "User is blocked" }`                           |
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
  "role": "seller",
  "isBlocked": false
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

Los usuarios siempre se crean desbloqueados (`isBlocked: false`): el campo no se
acepta en el cuerpo y un usuario no puede crearse bloqueado.

En ningún caso la contraseña viaja en las respuestas: se guarda como hash
bcrypt.

### `GET /roles`

Protegido: requiere un JWT con rol `admin`. Devuelve el catálogo de roles
guardado en la tabla `roles`, ordenado por `id` ascendente y con **solo** `id` y
`name` (sin `createdAt` ni `updatedAt`). Si la tabla está vacía responde `200`
con `[]`.

Los `name` de la respuesta son exactamente los valores que acepta el campo
`role` de `POST /users`, así que un frontend puede usar este endpoint para
poblar el selector de rol en lugar de escribir la lista a mano.

```bash
curl http://localhost:3001/roles -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
[
  { "id": 1, "name": "admin" },
  { "id": 2, "name": "seller" },
  { "id": 3, "name": "delivery" },
  { "id": 4, "name": "freelance_delivery" },
  { "id": 5, "name": "customer" }
]
```

Errores:

| Código | Cuerpo                          |
| ------ | ------------------------------- |
| `401`  | `{ "message": "Unauthorized" }` |
| `403`  | `{ "message": "Forbidden" }`    |

### `GET /users`

Protegido: requiere un JWT con rol `admin`. Devuelve la colección de usuarios
ordenada por `id` ascendente, con los datos públicos de cada uno y **sin**
`password` ni `roleId`. Si no hay usuarios responde `200` con `[]`.

```bash
curl http://localhost:3001/users -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
[
  {
    "id": 1,
    "username": "admin",
    "email": "admin@breadking.com",
    "name": "Administrador",
    "role": "admin",
    "isBlocked": false
  },
  {
    "id": 2,
    "username": "maria",
    "email": "maria@breadking.com",
    "name": "María",
    "role": "seller",
    "isBlocked": true
  }
]
```

Errores:

| Código | Cuerpo                          |
| ------ | ------------------------------- |
| `401`  | `{ "message": "Unauthorized" }` |
| `403`  | `{ "message": "Forbidden" }`    |

### `PATCH /users/:id/status`

Protegido: requiere un JWT con rol `admin`. Bloquea (`{ "isBlocked": true }`) o
desbloquea (`{ "isBlocked": false }`) al usuario indicado y devuelve sus datos
públicos actualizados. Un usuario bloqueado no puede iniciar sesión ni usar un
JWT emitido antes del bloqueo, pero no se elimina ni pierde su contraseña.

```bash
curl -X PATCH http://localhost:3001/users/2/status \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"isBlocked":true}'
```

Respuesta `200`:

```json
{
  "id": 2,
  "username": "maria",
  "email": "maria@breadking.com",
  "name": "María",
  "role": "seller",
  "isBlocked": true
}
```

Errores:

| Código | Cuerpo                                                         |
| ------ | -------------------------------------------------------------- |
| `400`  | `{ "message": "isBlocked is required" }`                       |
| `401`  | `{ "message": "Unauthorized" }`                                |
| `403`  | `{ "message": "Forbidden" }`                                   |
| `404`  | `{ "message": "User not found" }`                              |
| `409`  | `{ "message": "You cannot block your own account" }`           |
| `409`  | `{ "message": "Cannot block the last administrator" }`         |
| `422`  | `{ "errors": { "isBlocked": "isBlocked must be a boolean" } }` |
| `422`  | `{ "errors": { "id": "Invalid user id" } }`                    |

El bloqueo se ejecuta dentro de una transacción: el sistema nunca se queda sin
administradores activos.

### `DELETE /users/:id`

Protegido: requiere un JWT con rol `admin`. Elimina de forma permanente al
usuario indicado y responde `204` sin cuerpo. Sus códigos de recuperación de
contraseña pendientes se eliminan en cascada.

```bash
curl -X DELETE http://localhost:3001/users/2 \
  -H "Authorization: Bearer <jwt>"
```

Errores:

| Código | Cuerpo                                                  |
| ------ | ------------------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`                         |
| `403`  | `{ "message": "Forbidden" }`                            |
| `404`  | `{ "message": "User not found" }`                       |
| `409`  | `{ "message": "You cannot delete your own account" }`   |
| `409`  | `{ "message": "Cannot delete the last administrator" }` |
| `422`  | `{ "errors": { "id": "Invalid user id" } }`             |

Tanto el bloqueo como la eliminación se ejecutan dentro de una transacción
(`sequelize.transaction`) para que la comprobación de "último administrador" y
la escritura no sufran condiciones de carrera.

## Logs y manejo de errores

La API escribe logs en stdout/stderr con timestamp ISO, nivel (`INFO`, `WARN`,
`ERROR`) y contexto. Cada nivel lleva su propio símbolo y color: `🔍 INFO` en
**verde**, `⚠ WARN` en **amarillo** y `❌ ERROR` en **rojo**; la etiqueta va en
negrita y todo el mensaje toma el color del nivel cuando la salida es una
terminal interactiva. En CI/Docker o cuando `NO_COLOR` está definido se imprime
texto plano (el símbolo se conserva). `LOG_LEVEL` define el nivel mínimo impreso (`info` por defecto,
`warn` o `error` para reducir ruido). El logger nunca imprime contraseñas,
tokens, cookies ni códigos de recuperación: esos valores se reemplazan por
`[REDACTED]`.

Ejemplo de log de acceso:

```text
2026-09-13T10:15:31.002Z 🔍 INFO 200 GET /health requestId=8a2d...
```

### Logs de consultas SQL

Con `NODE_ENV=development` la API imprime cada consulta que Sequelize ejecuta,
coloreada según su operación y con el tiempo de ejecución en milisegundos:

| Operación | Color    |
| --------- | -------- |
| `SELECT`  | azul     |
| `UPDATE`  | amarillo |
| `INSERT`  | verde    |
| `DELETE`  | rojo     |

```text
2026-09-13T10:15:31.010Z SELECT "id", "username" FROM "users" AS "user"; (7 ms)
2026-09-13T10:15:31.120Z INSERT INTO "users" (...) VALUES (...); (3 ms)
```

Fuera de `development` (producción, tests) las consultas no se imprimen. Los
colores se desactivan con `NO_COLOR` o cuando la salida no es una terminal.

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

## CI/CD (GitLab)

El pipeline vive en `.gitlab-ci.yml` y tiene tres stages:

| Stage    | Cuándo corre                    | Qué hace                                                              |
| -------- | ------------------------------- | --------------------------------------------------------------------- |
| `test`   | MRs y push a cualquier rama/tag | `npm test` y `npm run test:integration` contra un servicio Postgres.  |
| `build`  | Solo tags (`v1.2.3`)            | Construye y publica en Docker Hub la imagen con el tag y `latest`.    |
| `deploy` | Solo tags                       | Despliega en la VM, corre migraciones/seeders y valida el contenedor. |

Para desplegar una versión basta con crear un tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Variables de CI/CD requeridas en GitLab (Settings → CI/CD → Variables):

| Variable                                                  | Uso                                           |
| --------------------------------------------------------- | --------------------------------------------- |
| `CI_DOCKERHUB_USERNAME`, `CI_DOCKERHUB_TOKEN`             | Credenciales de Docker Hub.                   |
| `DOCKERHUB_IMAGE`                                         | Nombre de la imagen, p. ej. `api-bread-king`. |
| `VM_HOSTNAME`, `VM_PORT`, `VM_USERNAME`, `VM_PASSWORD`    | Acceso SSH a la VM de despliegue.             |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Base de datos de producción.                  |
| `JWT_SECRET`, `JWT_EXPIRES_IN`                            | Configuración de autenticación.               |
| `GMAIL_USERNAME`, `GMAIL_TOKEN`                           | Envío de correos de recuperación.             |
| `LOG_LEVEL`                                               | Nivel de logs del contenedor (opcional).      |

El contenedor se llama `bread-king-api`, se une a la red `maseferlat` y se
recrea con `/app/create-container`; el healthcheck final usa `/app/check-container`.
