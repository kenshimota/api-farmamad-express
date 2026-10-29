# API Farmamad Express

REST API de Farmamad Express (producto Super King) construida con Express 5,
Sequelize 6 y PostgreSQL.

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
`JWT_EXPIRES_IN`, `CORS_ORIGIN`, `GMAIL_USERNAME`, `GMAIL_TOKEN`, `APP_NAME` y
`APP_URL` (ver `.env.example`).

`APP_NAME` es el nombre del producto que aparece en los correos (por defecto
`Super King`) y `APP_URL` es el link de ingreso incluido en el correo de
bienvenida (por defecto `https://dashboard.asic-guanipa.online/`). Si cualquiera
de las dos no está definida o está vacía se usa su valor por defecto.

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
CORS_ORIGIN=https://app.superking.com,https://admin.superking.com
```

Si `CORS_ORIGIN` no está definida o está vacía, se permite cualquier origen.

## Roles

Los roles viven en la tabla `roles` (no son un ENUM de Postgres) y se cargan
con el seeder idempotente `seeders/20260910000001-roles.js`:

| Rol                 | Uso                                                           |
| ------------------- | ------------------------------------------------------------- |
| `admin`             | Administra el sistema; único que puede crear usuarios.        |
| `customer`          | Usuario final.                                                |
| `seller`            | Gestiona ventas y pedidos.                                    |
| `dispatcher`        | Repartidor o coordinador de entregas; puede leer clientes.    |
| `manager_warehouse` | Responsable de almacén; todavía sin permisos administrativos. |
| `support`           | Atención al cliente; todavía sin permisos administrativos.    |

Los antiguos roles `delivery` y `freelance_delivery` ya no existen. La
migración `migrations/20260910000006-align-roles-catalog.js` reasigna a
`dispatcher` los usuarios que los tenían y elimina las filas obsoletas.

## Convenciones de la API

### Actualizaciones con `PUT`

Todo endpoint `PUT` que actualice un recurso existente responde `202 Accepted`
cuando la actualización se aplica correctamente. El cuerpo conserva el recurso
actualizado con el mismo esquema que devuelve la lectura del recurso (por
ejemplo, `Customer` o `Warehouse`) y la escritura se completa antes de
responder: no hay procesamiento en cola. Los errores (`400`, `401`, `403`,
`404`, `409`, `422` y `500`) mantienen sus códigos y cuerpos actuales.

Esta convención aplica a los endpoints actuales y a los futuros: el camino
exitoso de un `PUT` nunca responde `200` ni `204`.

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

Tras crearlo, la API envía un **correo de bienvenida** al `email` indicado. El
envío es un efecto secundario: si falla, el administrador igual queda creado y la
respuesta sigue siendo `201` (el fallo se registra en los logs).

Campos: `username`, `email`, `password` (mínimo 8 caracteres, requeridos) y
`name` (opcional).

```bash
curl -X POST http://localhost:3001/auth/register-admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@superking.com","password":"secreto123","name":"Administrador"}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@superking.com",
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
  -d '{"identifier":"admin@superking.com","password":"secreto123"}'
```

Respuesta `200`:

```json
{
  "token": "<jwt>",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@superking.com",
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
caracteres, nunca la contraseña normal de la cuenta). El nombre del producto y
el link de ingreso que aparecen en los correos se configuran con `APP_NAME` y
`APP_URL`.

### Correo de bienvenida

Al crear un usuario (`POST /users`) o registrar al admin inicial
(`POST /auth/register-admin`), la API envía un correo de **texto plano** en
español a la dirección del usuario creado. El asunto es
`¡Bienvenido a <APP_NAME>!` y el cuerpo incluye el saludo con el `name` del
usuario (o un saludo genérico si no tiene), el link `APP_URL` y la firma
`Equipo <APP_NAME>`. Un `409` por `username` o `email` duplicado no envía ningún
correo. Si el envío falla, el usuario igual queda creado, la respuesta sigue
siendo `201` y el fallo se registra con `logger.error(...)`.

### `POST /users`

Protegido: requiere un JWT con rol `admin`. Crea un usuario con uno de los
seis roles del catálogo: `admin`, `customer`, `seller`, `dispatcher`,
`manager_warehouse` o `support`.

Campos: `username`, `email`, `password` (mínimo 8 caracteres) y `role`
(requeridos); `name` (opcional). Si `username` o `email` ya existen responde
`409`; si el rol no existe en el catálogo (por ejemplo `delivery`,
`freelance_delivery` o cualquier otro valor) responde `422` con
`{ "errors": { "role": "Invalid role" } }`.

Tras crearlo, la API envía el **correo de bienvenida** al `email` del usuario
(ver _Correo de bienvenida_); un fallo de envío no cambia la respuesta `201`.

```bash
curl -X POST http://localhost:3001/users \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"username":"maria","email":"maria@superking.com","password":"secreto123","name":"María","role":"seller"}'
```

Respuesta `201`:

```json
{
  "id": 2,
  "username": "maria",
  "email": "maria@superking.com",
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

Los `id` dependen del orden en que se hayan insertado los roles; el ejemplo
muestra un catálogo recién creado, siempre ordenado por `id` ascendente.

```json
[
  { "id": 1, "name": "admin" },
  { "id": 2, "name": "customer" },
  { "id": 3, "name": "seller" },
  { "id": 4, "name": "dispatcher" },
  { "id": 5, "name": "manager_warehouse" },
  { "id": 6, "name": "support" }
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
    "email": "admin@superking.com",
    "name": "Administrador",
    "role": "admin",
    "isBlocked": false
  },
  {
    "id": 2,
    "username": "maria",
    "email": "maria@superking.com",
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
  "email": "maria@superking.com",
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

## Clientes

Los clientes viven en la tabla `customers` (modelo `Customer`), separada de
`users`: un cliente es un tercero al que se le vende, no un usuario que inicia
sesión. `latitude` y `longitude` se persisten como `DECIMAL(10,7)` y la API las
devuelve como **números** con hasta 7 decimales. Ninguna respuesta incluye
`createdAt`, `updatedAt` ni `isRegistered`.

Permisos por endpoint:

| Endpoint                | `admin` | `seller` | `dispatcher` | `manager_warehouse` | `support` | `customer` |
| ----------------------- | ------- | -------- | ------------ | ------------------- | --------- | ---------- |
| `POST /customers`       | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `GET /customers`        | ✅      | ✅       | ✅           | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `GET /customers/:id`    | ✅      | ✅       | ✅           | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `PUT /customers/:id`    | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `DELETE /customers/:id` | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |

Un usuario bloqueado recibe `403` con `{ "message": "User is blocked" }` en
todos los endpoints, y sin token (o con token inválido/expirado) la respuesta es
`401` con `{ "message": "Unauthorized" }`.

### `POST /customers`

Protegido: requiere un JWT con rol `admin` o `seller`. Campos requeridos:
`fullName`, `latitude` (entre `-90` y `90`), `longitude` (entre `-180` y `180`),
`direction` y `email`. El campo opcional `isRegistered` (booleano) se guarda en
la tabla pero no se expone en la respuesta.

```bash
curl -X POST http://localhost:3001/customers \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Juan Pérez","latitude":-17.7833,"longitude":-63.1821,"direction":"Av. Monseñor Rivero 123","email":"juan@example.com"}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "fullName": "Juan Pérez",
  "latitude": -17.7833,
  "longitude": -63.1821,
  "direction": "Av. Monseñor Rivero 123",
  "email": "juan@example.com"
}
```

Errores:

| Código | Cuerpo                                                                             |
| ------ | ---------------------------------------------------------------------------------- |
| `400`  | `{ "message": "fullName, latitude, longitude, direction and email are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                                                    |
| `403`  | `{ "message": "Forbidden" }`                                                       |
| `409`  | `{ "message": "Customer already exists" }`                                         |
| `422`  | `{ "errors": { "latitude": "Latitud inválida" } }`                                 |

### `GET /customers`

Protegido: requiere un JWT con rol `admin`, `seller` o `dispatcher`. Devuelve la
colección completa ordenada por `id` ascendente. Si no hay clientes responde
`200` con `[]` (nunca `404`).

```bash
curl http://localhost:3001/customers -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
[
  {
    "id": 1,
    "fullName": "Juan Pérez",
    "latitude": -17.7833,
    "longitude": -63.1821,
    "direction": "Av. Monseñor Rivero 123",
    "email": "juan@example.com"
  }
]
```

Errores:

| Código | Cuerpo                          |
| ------ | ------------------------------- |
| `401`  | `{ "message": "Unauthorized" }` |
| `403`  | `{ "message": "Forbidden" }`    |

### `GET /customers/:id`

Protegido: requiere un JWT con rol `admin`, `seller` o `dispatcher`. Devuelve un
único cliente.

```bash
curl http://localhost:3001/customers/1 -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
{
  "id": 1,
  "fullName": "Juan Pérez",
  "latitude": -17.7833,
  "longitude": -63.1821,
  "direction": "Av. Monseñor Rivero 123",
  "email": "juan@example.com"
}
```

Errores:

| Código | Cuerpo                                          |
| ------ | ----------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`                 |
| `403`  | `{ "message": "Forbidden" }`                    |
| `404`  | `{ "message": "Customer not found" }`           |
| `422`  | `{ "errors": { "id": "Invalid customer id" } }` |

### `PUT /customers/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Es una actualización
completa: exige los mismos campos que la creación (`fullName`, `latitude`,
`longitude`, `direction` y `email`); `isRegistered` es opcional y, si se omite,
conserva su valor anterior.

```bash
curl -X PUT http://localhost:3001/customers/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Juan Pérez Gómez","latitude":-17.79,"longitude":-63.19,"direction":"Av. Monseñor Rivero 456","email":"juan@example.com"}'
```

Respuesta `202`:

```json
{
  "id": 1,
  "fullName": "Juan Pérez Gómez",
  "latitude": -17.79,
  "longitude": -63.19,
  "direction": "Av. Monseñor Rivero 456",
  "email": "juan@example.com"
}
```

Errores:

| Código | Cuerpo                                                                             |
| ------ | ---------------------------------------------------------------------------------- |
| `400`  | `{ "message": "fullName, latitude, longitude, direction and email are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                                                    |
| `403`  | `{ "message": "Forbidden" }`                                                       |
| `404`  | `{ "message": "Customer not found" }`                                              |
| `409`  | `{ "message": "Customer already exists" }`                                         |
| `422`  | `{ "errors": { "id": "Invalid customer id" } }`                                    |

### `DELETE /customers/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Elimina de forma
permanente al cliente y responde `204` sin cuerpo. No toca la tabla `users`.

```bash
curl -X DELETE http://localhost:3001/customers/1 \
  -H "Authorization: Bearer <jwt>"
```

Errores:

| Código | Cuerpo                                          |
| ------ | ----------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`                 |
| `403`  | `{ "message": "Forbidden" }`                    |
| `404`  | `{ "message": "Customer not found" }`           |
| `422`  | `{ "errors": { "id": "Invalid customer id" } }` |

El email duplicado se detecta con la restricción única de Postgres
(`UniqueConstraintError`), de modo que dos peticiones simultáneas nunca crean
clientes repetidos.

## Bodegas

Las bodegas viven en la tabla `warehouses` (modelo `Warehouse`). `name` es
obligatorio pero **no único**, `address` es obligatorio y `observations` es un
`TEXT` opcional que se guarda como `NULL` cuando se omite o se envía `null`.
Ninguna respuesta incluye `createdAt` ni `updatedAt`.

Permisos por endpoint:

| Endpoint                 | `admin` | `seller` | `dispatcher` | `manager_warehouse` | `support` | `customer` |
| ------------------------ | ------- | -------- | ------------ | ------------------- | --------- | ---------- |
| `POST /warehouses`       | ✅      | ❌ `403` | ❌ `403`     | ✅                  | ❌ `403`  | ❌ `403`   |
| `GET /warehouses`        | ✅      | ❌ `403` | ✅           | ✅                  | ❌ `403`  | ❌ `403`   |
| `GET /warehouses/:id`    | ✅      | ❌ `403` | ✅           | ✅                  | ❌ `403`  | ❌ `403`   |
| `PUT /warehouses/:id`    | ✅      | ❌ `403` | ❌ `403`     | ✅                  | ❌ `403`  | ❌ `403`   |
| `DELETE /warehouses/:id` | ✅      | ❌ `403` | ❌ `403`     | ✅                  | ❌ `403`  | ❌ `403`   |

Un usuario bloqueado recibe `403` con `{ "message": "User is blocked" }` en
todos los endpoints, y sin token (o con token inválido/expirado) la respuesta es
`401` con `{ "message": "Unauthorized" }`.

### `POST /warehouses`

Protegido: requiere un JWT con rol `admin` o `manager_warehouse`. Campos
requeridos: `name` y `address`, ambos no vacíos (tampoco solo espacios). El campo
opcional `observations` se recorta y se guarda como `NULL` si se omite o se
envía `null`. Los campos desconocidos y de auditoría se descartan.

```bash
curl -X POST http://localhost:3001/warehouses \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bodega Central","observations":"Horario de 8 a 18","address":"Av. Monseñor Rivero 123"}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "name": "Bodega Central",
  "observations": "Horario de 8 a 18",
  "address": "Av. Monseñor Rivero 123"
}
```

Errores:

| Código | Cuerpo                                           |
| ------ | ------------------------------------------------ |
| `400`  | `{ "message": "name and address are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                  |
| `403`  | `{ "message": "Forbidden" }`                     |
| `422`  | `{ "errors": { "name": "Nombre inválido" } }`    |

Los mensajes de validación son `"Nombre inválido"`, `"Dirección inválida"` y
`"Observaciones inválidas"` según el campo.

### `GET /warehouses`

Protegido: requiere un JWT con rol `admin`, `dispatcher` o
`manager_warehouse`. Devuelve la colección ordenada por `id` ascendente y con
solo los campos públicos. Si no hay bodegas responde `200` con `[]`.

Parámetro de query opcional:

| Parámetro | Tipo   | Descripción                                                                                    |
| --------- | ------ | ---------------------------------------------------------------------------------------------- |
| `search`  | string | Filtro parcial e insensible a mayúsculas sobre `name`, `observations` y `address`. Se recorta. |

`search` omitido, vacío o solo espacios devuelve el listado completo. Si una
bodega coincide en varios campos aparece una sola vez; sin coincidencias
responde `200` con `[]`.

```bash
curl "http://localhost:3001/warehouses?search=central" \
  -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
[
  {
    "id": 1,
    "name": "Bodega Central",
    "observations": "Horario de 8 a 18",
    "address": "Av. Monseñor Rivero 123"
  }
]
```

Errores:

| Código | Cuerpo                          |
| ------ | ------------------------------- |
| `401`  | `{ "message": "Unauthorized" }` |
| `403`  | `{ "message": "Forbidden" }`    |

### `GET /warehouses/:id`

Protegido: requiere un JWT con rol `admin`, `dispatcher` o
`manager_warehouse`. Devuelve una única bodega.

```bash
curl http://localhost:3001/warehouses/1 -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
{
  "id": 1,
  "name": "Bodega Central",
  "observations": "Horario de 8 a 18",
  "address": "Av. Monseñor Rivero 123"
}
```

Errores:

| Código | Cuerpo                                           |
| ------ | ------------------------------------------------ |
| `401`  | `{ "message": "Unauthorized" }`                  |
| `403`  | `{ "message": "Forbidden" }`                     |
| `404`  | `{ "message": "Warehouse not found" }`           |
| `422`  | `{ "errors": { "id": "Invalid warehouse id" } }` |

### `PUT /warehouses/:id`

Protegido: requiere un JWT con rol `admin` o `manager_warehouse`. Reemplaza
`name` y `address` (obligatorios) y actualiza `observations` solo si se envía;
si se omite, conserva el valor anterior. Enviar `"observations": null` lo limpia.

```bash
curl -X PUT http://localhost:3001/warehouses/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bodega Sur","address":"Calle 3 #10"}'
```

Respuesta `202`:

```json
{
  "id": 1,
  "name": "Bodega Sur",
  "observations": "Horario de 8 a 18",
  "address": "Calle 3 #10"
}
```

Errores:

| Código | Cuerpo                                           |
| ------ | ------------------------------------------------ |
| `400`  | `{ "message": "name and address are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                  |
| `403`  | `{ "message": "Forbidden" }`                     |
| `404`  | `{ "message": "Warehouse not found" }`           |
| `422`  | `{ "errors": { "id": "Invalid warehouse id" } }` |

### `DELETE /warehouses/:id`

Protegido: requiere un JWT con rol `admin` o `manager_warehouse`. Elimina la
bodega de forma permanente y responde `204` sin cuerpo.

```bash
curl -X DELETE http://localhost:3001/warehouses/1 \
  -H "Authorization: Bearer <jwt>"
```

Errores:

| Código | Cuerpo                                           |
| ------ | ------------------------------------------------ |
| `401`  | `{ "message": "Unauthorized" }`                  |
| `403`  | `{ "message": "Forbidden" }`                     |
| `404`  | `{ "message": "Warehouse not found" }`           |
| `422`  | `{ "errors": { "id": "Invalid warehouse id" } }` |

## Categorías

Las categorías viven en la tabla `categories` (modelo `Category`). `name` es
obligatorio, único y admite hasta 100 caracteres; la API lo recorta antes de
guardarlo. Ninguna respuesta incluye `createdAt` ni `updatedAt`: solo se exponen
`id` y `name`.

Permisos por endpoint:

| Endpoint                 | `admin` | `seller` | `dispatcher` | `manager_warehouse` | `support` | `customer` |
| ------------------------ | ------- | -------- | ------------ | ------------------- | --------- | ---------- |
| `POST /categories`       | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `GET /categories`        | ✅      | ✅       | ✅           | ✅                  | ✅        | ✅         |
| `GET /categories/:id`    | ✅      | ✅       | ✅           | ✅                  | ✅        | ✅         |
| `PUT /categories/:id`    | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `DELETE /categories/:id` | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |

Un usuario bloqueado recibe `403` con `{ "message": "User is blocked" }` en
todos los endpoints, y sin token (o con token inválido/expirado) la respuesta es
`401` con `{ "message": "Unauthorized" }`.

### `POST /categories`

Protegido: requiere un JWT con rol `admin` o `seller`. Campo requerido: `name`
(no vacío, tampoco solo espacios, máximo 100 caracteres). Los campos
desconocidos y de auditoría se descartan.

```bash
curl -X POST http://localhost:3001/categories \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Analgésicos"}'
```

Respuesta `201`:

```json
{ "id": 1, "name": "Analgésicos" }
```

Errores:

| Código | Cuerpo                                        |
| ------ | --------------------------------------------- |
| `400`  | `{ "message": "name is required" }`           |
| `401`  | `{ "message": "Unauthorized" }`               |
| `403`  | `{ "message": "Forbidden" }`                  |
| `409`  | `{ "message": "Category already exists" }`    |
| `422`  | `{ "errors": { "name": "Nombre inválido" } }` |

### `GET /categories`

Protegido: requiere un JWT válido, de cualquier rol. Devuelve la colección
completa ordenada por `id` ascendente. Si no hay categorías responde `200` con
`[]` (nunca `404`).

```bash
curl http://localhost:3001/categories -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
[
  { "id": 1, "name": "Analgésicos" },
  { "id": 2, "name": "Antiinflamatorios" }
]
```

Errores:

| Código | Cuerpo                             |
| ------ | ---------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`    |
| `403`  | `{ "message": "User is blocked" }` |

### `GET /categories/:id`

Protegido: requiere un JWT válido, de cualquier rol. Devuelve una única
categoría.

```bash
curl http://localhost:3001/categories/1 -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
{ "id": 1, "name": "Analgésicos" }
```

Errores:

| Código | Cuerpo                                          |
| ------ | ----------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`                 |
| `403`  | `{ "message": "User is blocked" }`              |
| `404`  | `{ "message": "Category not found" }`           |
| `422`  | `{ "errors": { "id": "Invalid category id" } }` |

### `PUT /categories/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Reemplaza el recurso y
exige `name`, con las mismas validaciones y el mismo `409` por nombre duplicado
que la creación.

```bash
curl -X PUT http://localhost:3001/categories/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Antiinflamatorios"}'
```

Respuesta `202`:

```json
{ "id": 1, "name": "Antiinflamatorios" }
```

Errores:

| Código | Cuerpo                                          |
| ------ | ----------------------------------------------- |
| `400`  | `{ "message": "name is required" }`             |
| `401`  | `{ "message": "Unauthorized" }`                 |
| `403`  | `{ "message": "Forbidden" }`                    |
| `404`  | `{ "message": "Category not found" }`           |
| `409`  | `{ "message": "Category already exists" }`      |
| `422`  | `{ "errors": { "id": "Invalid category id" } }` |

### `DELETE /categories/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Elimina la categoría de
forma permanente y responde `204` sin cuerpo. Si un producto la referencia,
responde `409` con `{ "message": "Category is in use" }` y no la elimina.

```bash
curl -X DELETE http://localhost:3001/categories/1 \
  -H "Authorization: Bearer <jwt>"
```

Errores:

| Código | Cuerpo                                          |
| ------ | ----------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`                 |
| `403`  | `{ "message": "Forbidden" }`                    |
| `404`  | `{ "message": "Category not found" }`           |
| `409`  | `{ "message": "Category is in use" }`           |
| `422`  | `{ "errors": { "id": "Invalid category id" } }` |

## Imágenes

Las imágenes viven en la tabla `images` (modelo `Image`). `url`, `reference` y
`thumbnail` son obligatorios; `pathname` es opcional y se guarda como `null`
cuando la imagen solo existe en S3. `url` y `thumbnail` son URLs de hasta 2048
caracteres, `reference` es única y admite hasta 100 caracteres (se recorta), y
`pathname` es una ruta de hasta 2048 caracteres que también se recorta. Ninguna
respuesta incluye `createdAt` ni `updatedAt`: solo se exponen `id`, `url`,
`pathname`, `reference` y `thumbnail`.

Permisos por endpoint:

| Endpoint             | `admin` | `seller` | `dispatcher` | `manager_warehouse` | `support` | `customer` |
| -------------------- | ------- | -------- | ------------ | ------------------- | --------- | ---------- |
| `POST /images`       | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `GET /images`        | ✅      | ✅       | ✅           | ✅                  | ✅        | ✅         |
| `GET /images/:id`    | ✅      | ✅       | ✅           | ✅                  | ✅        | ✅         |
| `PUT /images/:id`    | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `DELETE /images/:id` | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |

Un usuario bloqueado recibe `403` con `{ "message": "User is blocked" }` en
todos los endpoints, y sin token (o con token inválido/expirado) la respuesta es
`401` con `{ "message": "Unauthorized" }`.

### `POST /images`

Protegido: requiere un JWT con rol `admin` o `seller`. Campos requeridos: `url`,
`reference` y `thumbnail`; `pathname` es opcional. Los campos desconocidos y de
auditoría se descartan. Si se omite `pathname`, se guarda `null` (caso S3).

```bash
curl -X POST http://localhost:3001/images \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://cdn.farmamad.com/products/ibuprofeno.png","pathname":"/uploads/products/ibuprofeno.png","reference":"ibuprofeno-400","thumbnail":"https://cdn.farmamad.com/products/ibuprofeno-thumb.png"}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "url": "https://cdn.farmamad.com/products/ibuprofeno.png",
  "pathname": "/uploads/products/ibuprofeno.png",
  "reference": "ibuprofeno-400",
  "thumbnail": "https://cdn.farmamad.com/products/ibuprofeno-thumb.png"
}
```

Si la imagen se sube a S3, se omite `pathname` y se responde con
`"pathname": null`.

Errores:

| Código | Cuerpo                                                       |
| ------ | ------------------------------------------------------------ |
| `400`  | `{ "message": "url, reference and thumbnail are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                              |
| `403`  | `{ "message": "Forbidden" }`                                 |
| `409`  | `{ "message": "Image already exists" }`                      |
| `422`  | `{ "errors": { "url": "URL inválida" } }`                    |

### `GET /images`

Protegido: requiere un JWT válido, de cualquier rol. Devuelve la colección
completa ordenada por `id` ascendente. Si no hay imágenes responde `200` con
`[]` (nunca `404`).

```bash
curl http://localhost:3001/images -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
[
  {
    "id": 1,
    "url": "https://cdn.farmamad.com/products/ibuprofeno.png",
    "pathname": "/uploads/products/ibuprofeno.png",
    "reference": "ibuprofeno-400",
    "thumbnail": "https://cdn.farmamad.com/products/ibuprofeno-thumb.png"
  }
]
```

Errores:

| Código | Cuerpo                             |
| ------ | ---------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`    |
| `403`  | `{ "message": "User is blocked" }` |

### `GET /images/:id`

Protegido: requiere un JWT válido, de cualquier rol. Devuelve una única imagen.

```bash
curl http://localhost:3001/images/1 -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
{
  "id": 1,
  "url": "https://cdn.farmamad.com/products/ibuprofeno.png",
  "pathname": "/uploads/products/ibuprofeno.png",
  "reference": "ibuprofeno-400",
  "thumbnail": "https://cdn.farmamad.com/products/ibuprofeno-thumb.png"
}
```

Errores:

| Código | Cuerpo                                       |
| ------ | -------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`              |
| `403`  | `{ "message": "User is blocked" }`           |
| `404`  | `{ "message": "Image not found" }`           |
| `422`  | `{ "errors": { "id": "Invalid image id" } }` |

### `PUT /images/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Reemplaza el recurso y
exige `url`, `reference` y `thumbnail`; `pathname` es opcional y, si se omite,
se guarda `null`. Aplica las mismas validaciones y el mismo `409` por
`reference` duplicada que la creación.

```bash
curl -X PUT http://localhost:3001/images/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://cdn.farmamad.com/products/ibuprofeno-800.png","pathname":"/uploads/products/ibuprofeno-800.png","reference":"ibuprofeno-800","thumbnail":"https://cdn.farmamad.com/products/ibuprofeno-800-thumb.png"}'
```

Respuesta `202`:

```json
{
  "id": 1,
  "url": "https://cdn.farmamad.com/products/ibuprofeno-800.png",
  "pathname": "/uploads/products/ibuprofeno-800.png",
  "reference": "ibuprofeno-800",
  "thumbnail": "https://cdn.farmamad.com/products/ibuprofeno-800-thumb.png"
}
```

Errores:

| Código | Cuerpo                                                       |
| ------ | ------------------------------------------------------------ |
| `400`  | `{ "message": "url, reference and thumbnail are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                              |
| `403`  | `{ "message": "Forbidden" }`                                 |
| `404`  | `{ "message": "Image not found" }`                           |
| `409`  | `{ "message": "Image already exists" }`                      |
| `422`  | `{ "errors": { "id": "Invalid image id" } }`                 |

### `DELETE /images/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Elimina la imagen de
forma permanente y responde `204` sin cuerpo. Si un producto la referencia,
responde `409` con `{ "message": "Image is in use" }` y no la elimina.

```bash
curl -X DELETE http://localhost:3001/images/1 \
  -H "Authorization: Bearer <jwt>"
```

Errores:

| Código | Cuerpo                                       |
| ------ | -------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`              |
| `403`  | `{ "message": "Forbidden" }`                 |
| `404`  | `{ "message": "Image not found" }`           |
| `409`  | `{ "message": "Image is in use" }`           |
| `422`  | `{ "errors": { "id": "Invalid image id" } }` |

## Productos

Los productos viven en la tabla `products` (modelo `Product`). `name` admite
hasta 150 caracteres, `description` es texto libre obligatorio y `reference` es
obligatoria, única y de hasta 100 caracteres. `category_id` e `image_id` son
obligatorios y referencian `categories.id` e `images.id`; ambas FKs usan
`ON DELETE RESTRICT`, así que no se puede borrar una categoría o una imagen que
tenga productos asociados. Los textos se recortan antes de guardarse. Ninguna
respuesta incluye `createdAt` ni `updatedAt`: solo se exponen `id`, `name`,
`description`, `reference`, `category_id` e `image_id`.

Permisos por endpoint:

| Endpoint               | `admin` | `seller` | `dispatcher` | `manager_warehouse` | `support` | `customer` |
| ---------------------- | ------- | -------- | ------------ | ------------------- | --------- | ---------- |
| `POST /products`       | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `GET /products`        | ✅      | ✅       | ✅           | ✅                  | ✅        | ✅         |
| `GET /products/:id`    | ✅      | ✅       | ✅           | ✅                  | ✅        | ✅         |
| `PUT /products/:id`    | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `DELETE /products/:id` | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |

Un usuario bloqueado recibe `403` con `{ "message": "User is blocked" }` en
todos los endpoints, y sin token (o con token inválido/expirado) la respuesta es
`401` con `{ "message": "Unauthorized" }`.

### `POST /products`

Protegido: requiere un JWT con rol `admin` o `seller`. Campos requeridos:
`name`, `description`, `reference`, `category_id` e `image_id`. Los campos
desconocidos y de auditoría se descartan. Antes de insertar se verifica que la
categoría y la imagen existan; si alguna no existe responde `422` con el error
de su campo. La restricción única de `reference` y las FKs de Postgres actúan
como salvaguarda ante peticiones concurrentes.

```bash
curl -X POST http://localhost:3001/products \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ibuprofeno 400 mg","description":"Analgésico y antiinflamatorio","reference":"IBU-400","category_id":1,"image_id":1}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "name": "Ibuprofeno 400 mg",
  "description": "Analgésico y antiinflamatorio",
  "reference": "IBU-400",
  "category_id": 1,
  "image_id": 1
}
```

Errores:

| Código | Cuerpo                                                                                 |
| ------ | -------------------------------------------------------------------------------------- |
| `400`  | `{ "message": "name, description, reference, category_id and image_id are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                                                        |
| `403`  | `{ "message": "Forbidden" }`                                                           |
| `409`  | `{ "message": "Product already exists" }`                                              |
| `422`  | `{ "errors": { "category_id": "Invalid category id" } }`                               |
| `422`  | `{ "errors": { "image_id": "Invalid image id" } }`                                     |

### `GET /products`

Protegido: requiere un JWT válido, de cualquier rol. Devuelve la colección
completa ordenada por `id` ascendente. Si no hay productos responde `200` con
`[]` (nunca `404`).

```bash
curl http://localhost:3001/products -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
[
  {
    "id": 1,
    "name": "Ibuprofeno 400 mg",
    "description": "Analgésico y antiinflamatorio",
    "reference": "IBU-400",
    "category_id": 1,
    "image_id": 1
  }
]
```

Errores:

| Código | Cuerpo                             |
| ------ | ---------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`    |
| `403`  | `{ "message": "User is blocked" }` |

### `GET /products/:id`

Protegido: requiere un JWT válido, de cualquier rol. Devuelve un único producto.

```bash
curl http://localhost:3001/products/1 -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
{
  "id": 1,
  "name": "Ibuprofeno 400 mg",
  "description": "Analgésico y antiinflamatorio",
  "reference": "IBU-400",
  "category_id": 1,
  "image_id": 1
}
```

Errores:

| Código | Cuerpo                                         |
| ------ | ---------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`                |
| `403`  | `{ "message": "User is blocked" }`             |
| `404`  | `{ "message": "Product not found" }`           |
| `422`  | `{ "errors": { "id": "Invalid product id" } }` |

### `PUT /products/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Reemplaza el recurso y
exige los cinco campos, con las mismas validaciones, el `409` por `reference`
duplicada y la verificación de `category_id`/`image_id` que la creación.

```bash
curl -X PUT http://localhost:3001/products/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ibuprofeno 800 mg","description":"Analgésico y antiinflamatorio","reference":"IBU-800","category_id":1,"image_id":1}'
```

Respuesta `202`:

```json
{
  "id": 1,
  "name": "Ibuprofeno 800 mg",
  "description": "Analgésico y antiinflamatorio",
  "reference": "IBU-800",
  "category_id": 1,
  "image_id": 1
}
```

Errores:

| Código | Cuerpo                                                                                 |
| ------ | -------------------------------------------------------------------------------------- |
| `400`  | `{ "message": "name, description, reference, category_id and image_id are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                                                        |
| `403`  | `{ "message": "Forbidden" }`                                                           |
| `404`  | `{ "message": "Product not found" }`                                                   |
| `409`  | `{ "message": "Product already exists" }`                                              |
| `422`  | `{ "errors": { "id": "Invalid product id" } }`                                         |
| `422`  | `{ "errors": { "category_id": "Invalid category id" } }`                               |
| `422`  | `{ "errors": { "image_id": "Invalid image id" } }`                                     |

### `DELETE /products/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Elimina el producto de
forma permanente y responde `204` sin cuerpo. No elimina la categoría ni la
imagen asociadas; permanecen disponibles para otros productos.

```bash
curl -X DELETE http://localhost:3001/products/1 \
  -H "Authorization: Bearer <jwt>"
```

Errores:

| Código | Cuerpo                                         |
| ------ | ---------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`                |
| `403`  | `{ "message": "Forbidden" }`                   |
| `404`  | `{ "message": "Product not found" }`           |
| `422`  | `{ "errors": { "id": "Invalid product id" } }` |

## Estados

Los estados viven en la tabla `states` (modelo `State`) y representan las 23
entidades federales de Venezuela más el Distrito Capital. `name` es obligatorio,
único sin distinguir mayúsculas y admite 2–100 caracteres; `code` es obligatorio,
único, de 2–10 caracteres y se guarda en mayúsculas. Ninguna respuesta incluye
`createdAt` ni `updatedAt`: solo se exponen `id`, `name` y `code`.

La unicidad del nombre se implementa con un índice único funcional sobre
`LOWER(name)`, así `Aragua`, `ARAGUA` y `aragua` compiten por el mismo valor.

Permisos por endpoint:

| Endpoint             | `admin` | `seller` | `dispatcher` | `manager_warehouse` | `support` | `customer` |
| -------------------- | ------- | -------- | ------------ | ------------------- | --------- | ---------- |
| `POST /states`       | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `GET /states`        | ✅      | ✅       | ✅           | ✅                  | ✅        | ✅         |
| `GET /states/:id`    | ✅      | ✅       | ✅           | ✅                  | ✅        | ✅         |
| `PUT /states/:id`    | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `DELETE /states/:id` | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |

Un usuario bloqueado recibe `403` con `{ "message": "User is blocked" }` en
todos los endpoints, y sin token (o con token inválido/expirado) la respuesta es
`401` con `{ "message": "Unauthorized" }`.

### `POST /states`

Protegido: requiere un JWT con rol `admin` o `seller`. Campos requeridos: `name`
y `code`. El nombre se recorta y el código se guarda en mayúsculas.

```bash
curl -X POST http://localhost:3001/states \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Aragua","code":"VE-D"}'
```

Respuesta `201`:

```json
{ "id": 4, "name": "Aragua", "code": "VE-D" }
```

Errores:

| Código | Cuerpo                                        |
| ------ | --------------------------------------------- |
| `400`  | `{ "message": "name and code are required" }` |
| `401`  | `{ "message": "Unauthorized" }`               |
| `403`  | `{ "message": "Forbidden" }`                  |
| `409`  | `{ "message": "State already exists" }`       |
| `422`  | `{ "errors": { "name": "Nombre inválido" } }` |
| `422`  | `{ "errors": { "code": "Código inválido" } }` |

### `GET /states`

Protegido: requiere un JWT válido, de cualquier rol. Devuelve la colección
completa ordenada por `name` ascendente. Si no hay estados responde `200` con
`[]`.

```bash
curl http://localhost:3001/states -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
[
  { "id": 1, "name": "Amazonas", "code": "VE-Z" },
  { "id": 2, "name": "Anzoátegui", "code": "VE-B" }
]
```

Errores:

| Código | Cuerpo                             |
| ------ | ---------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`    |
| `403`  | `{ "message": "User is blocked" }` |

### `GET /states/:id`

Protegido: requiere un JWT válido, de cualquier rol. Devuelve un único estado.

```bash
curl http://localhost:3001/states/4 -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
{ "id": 4, "name": "Aragua", "code": "VE-D" }
```

Errores:

| Código | Cuerpo                                       |
| ------ | -------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`              |
| `403`  | `{ "message": "User is blocked" }`           |
| `404`  | `{ "message": "State not found" }`           |
| `422`  | `{ "errors": { "id": "Invalid state id" } }` |

### `PUT /states/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Actualiza `name` y/o
`code`; al menos uno debe estar presente. Responde `202` con el recurso
actualizado.

```bash
curl -X PUT http://localhost:3001/states/4 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"code":"VE-D"}'
```

Respuesta `202`:

```json
{ "id": 4, "name": "Aragua", "code": "VE-D" }
```

Errores:

| Código | Cuerpo                                       |
| ------ | -------------------------------------------- |
| `400`  | `{ "message": "name or code is required" }`  |
| `401`  | `{ "message": "Unauthorized" }`              |
| `403`  | `{ "message": "Forbidden" }`                 |
| `404`  | `{ "message": "State not found" }`           |
| `409`  | `{ "message": "State already exists" }`      |
| `422`  | `{ "errors": { "id": "Invalid state id" } }` |

### `DELETE /states/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Elimina el estado y
responde `204` sin cuerpo. Si tiene ciudades asociadas responde `409` con
`{ "message": "State has cities" }` y no lo elimina.

```bash
curl -X DELETE http://localhost:3001/states/4 \
  -H "Authorization: Bearer <jwt>"
```

Errores:

| Código | Cuerpo                                       |
| ------ | -------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`              |
| `403`  | `{ "message": "Forbidden" }`                 |
| `404`  | `{ "message": "State not found" }`           |
| `409`  | `{ "message": "State has cities" }`          |
| `422`  | `{ "errors": { "id": "Invalid state id" } }` |

## Ciudades

Las ciudades viven en la tabla `cities` (modelo `City`). `name` es obligatorio y
admite 2–100 caracteres; `state_id` es obligatorio y referencia `states.id` con
`ON DELETE RESTRICT`. El par `(name, state_id)` es único, por lo que el mismo
nombre puede existir en estados distintos pero no dos veces en el mismo. Las
respuestas exponen `id`, `name` y `state_id`; el objeto `state` anidado solo
aparece en la lista cuando se envía `?include=state`.

Permisos por endpoint:

| Endpoint             | `admin` | `seller` | `dispatcher` | `manager_warehouse` | `support` | `customer` |
| -------------------- | ------- | -------- | ------------ | ------------------- | --------- | ---------- |
| `POST /cities`       | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `GET /cities`        | ✅      | ✅       | ✅           | ✅                  | ✅        | ✅         |
| `GET /cities/:id`    | ✅      | ✅       | ✅           | ✅                  | ✅        | ✅         |
| `PUT /cities/:id`    | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `DELETE /cities/:id` | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |

### `POST /cities`

Protegido: requiere un JWT con rol `admin` o `seller`. Campos requeridos: `name`
y `state_id`. Antes de insertar se verifica que el estado exista.

```bash
curl -X POST http://localhost:3001/cities \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Maracay","state_id":4}'
```

Respuesta `201`:

```json
{ "id": 10, "name": "Maracay", "state_id": 4 }
```

Errores:

| Código | Cuerpo                                            |
| ------ | ------------------------------------------------- |
| `400`  | `{ "message": "name and state_id are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                   |
| `403`  | `{ "message": "Forbidden" }`                      |
| `409`  | `{ "message": "City already exists" }`            |
| `422`  | `{ "errors": { "state_id": "Invalid state" } }`   |

### `GET /cities`

Protegido: requiere un JWT válido, de cualquier rol. Acepta `?state_id=<id>`
para un filtro exacto y `?include=state` para anidar el estado. Devuelve las
ciudades ordenadas por `id` ascendente.

```bash
curl "http://localhost:3001/cities?state_id=4&include=state" \
  -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
[
  {
    "id": 10,
    "name": "Maracay",
    "state_id": 4,
    "state": { "id": 4, "name": "Aragua", "code": "VE-D" }
  }
]
```

Sin `include=state` cada ciudad solo devuelve `id`, `name` y `state_id`. Con
`state_id` inválido responde `422` con
`{ "errors": { "state_id": "Invalid state" } }`.

Errores:

| Código | Cuerpo                                          |
| ------ | ----------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`                 |
| `403`  | `{ "message": "User is blocked" }`              |
| `422`  | `{ "errors": { "state_id": "Invalid state" } }` |

### `GET /cities/:id`

Protegido: requiere un JWT válido, de cualquier rol. Devuelve una ciudad con el
contrato simple, sin el estado anidado.

```bash
curl http://localhost:3001/cities/10 -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
{ "id": 10, "name": "Maracay", "state_id": 4 }
```

Errores:

| Código | Cuerpo                                      |
| ------ | ------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`             |
| `403`  | `{ "message": "User is blocked" }`          |
| `404`  | `{ "message": "City not found" }`           |
| `422`  | `{ "errors": { "id": "Invalid city id" } }` |

### `PUT /cities/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Actualiza `name` y/o
`state_id`; al menos uno debe estar presente. Responde `202` con la ciudad
actualizada.

```bash
curl -X PUT http://localhost:3001/cities/10 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Turmero"}'
```

Respuesta `202`:

```json
{ "id": 10, "name": "Turmero", "state_id": 4 }
```

Errores:

| Código | Cuerpo                                          |
| ------ | ----------------------------------------------- |
| `400`  | `{ "message": "name or state_id is required" }` |
| `401`  | `{ "message": "Unauthorized" }`                 |
| `403`  | `{ "message": "Forbidden" }`                    |
| `404`  | `{ "message": "City not found" }`               |
| `409`  | `{ "message": "City already exists" }`          |
| `422`  | `{ "errors": { "id": "Invalid city id" } }`     |
| `422`  | `{ "errors": { "state_id": "Invalid state" } }` |

### `DELETE /cities/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Elimina la ciudad y
responde `204` sin cuerpo. Si un proveedor la referencia responde `409` con
`{ "message": "City is in use" }` y no la elimina.

```bash
curl -X DELETE http://localhost:3001/cities/10 \
  -H "Authorization: Bearer <jwt>"
```

Errores:

| Código | Cuerpo                                      |
| ------ | ------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`             |
| `403`  | `{ "message": "Forbidden" }`                |
| `404`  | `{ "message": "City not found" }`           |
| `409`  | `{ "message": "City is in use" }`           |
| `422`  | `{ "errors": { "id": "Invalid city id" } }` |

### Semillas de estados y ciudades

`npm run db:seed` carga 24 estados (23 entidades federales + Distrito Capital,
sin Dependencias Federales `VE-W`) y 38 ciudades: la capital de cada estado más
Puerto La Cruz, El Tigre, Ciudad Guayana, Puerto Cabello, Punto Fijo, Cabimas,
Acarigua, Araure, Valera, Guarenas, Guatire, Petare, Baruta y El Vigía. Ambas
semillas son idempotentes (`ignoreDuplicates`) y su `down` elimina primero las
ciudades sembradas y luego los estados sembrados, sin tocar registros creados
por usuarios. Si un estado falta al sembrar ciudades, el seeder falla con un
mensaje que indica el estado y la ciudad.

## Proveedores

Los proveedores viven en la tabla `suppliers` (modelo `Supplier`) y guardan los
datos de contacto y la ubicación. `name` admite 2–150 caracteres;
`identification` es obligatorio, se guarda como texto en mayúsculas y es único
sin distinguir mayúsculas (índice funcional `LOWER(identification)`); `email` es
obligatorio y válido pero **no** único; `phone` admite `+`, espacios, guiones y
paréntesis; `observations` es opcional hasta 1000 caracteres; `address` admite
5–255 caracteres. `city_id` y `state_id` son obligatorios, referencian
`cities.id` y `states.id` con `ON DELETE RESTRICT`, y la ciudad debe pertenecer
al estado indicado. Las respuestas no exponen `createdAt` ni `updatedAt`.

Permisos por endpoint:

| Endpoint                | `admin` | `seller` | `dispatcher` | `manager_warehouse` | `support` | `customer` |
| ----------------------- | ------- | -------- | ------------ | ------------------- | --------- | ---------- |
| `POST /suppliers`       | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `GET /suppliers`        | ✅      | ✅       | ✅           | ✅                  | ✅        | ✅         |
| `GET /suppliers/:id`    | ✅      | ✅       | ✅           | ✅                  | ✅        | ✅         |
| `PUT /suppliers/:id`    | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `DELETE /suppliers/:id` | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |

### `POST /suppliers`

Protegido: requiere un JWT con rol `admin` o `seller`. Campos requeridos:
`name`, `identification`, `email`, `phone`, `address`, `city_id` y `state_id`;
`observations` es opcional. La identificación se normaliza a mayúsculas y el
correo a minúsculas. Antes de insertar se verifica que la ciudad exista y
pertenezca al estado. Con `?include=location` la respuesta anida `city` y
`state`.

```bash
curl -X POST "http://localhost:3001/suppliers?include=location" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Distribuidora La Salud C.A.","identification":"J-12345678-9","email":"ventas@lasalud.com","phone":"+58 212 555-1234","observations":"Entrega los martes","address":"Av. Principal, Galpón 4","city_id":10,"state_id":4}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "name": "Distribuidora La Salud C.A.",
  "identification": "J-12345678-9",
  "email": "ventas@lasalud.com",
  "phone": "+58 212 555-1234",
  "observations": "Entrega los martes",
  "address": "Av. Principal, Galpón 4",
  "city_id": 10,
  "state_id": 4,
  "city": { "id": 10, "name": "Maracay" },
  "state": { "id": 4, "name": "Aragua", "code": "VE-D" }
}
```

Errores:

| Código | Cuerpo                                                                                                                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `{ "message": "name, identification, email, phone, address, city_id and state_id are required" }`                           |
| `401`  | `{ "message": "Unauthorized" }`                                                                                             |
| `403`  | `{ "message": "Forbidden" }`                                                                                                |
| `409`  | `{ "message": "Supplier already exists" }`                                                                                  |
| `422`  | `{ "errors": { "city_id": "Invalid city id" } }`                                                                            |
| `422`  | `{ "errors": { "state_id": "Invalid state" } }`                                                                             |
| `422`  | `{ "errors": { "city_id": "City does not belong to state" } }`                                                              |

### `GET /suppliers`

Protegido: requiere un JWT válido, de cualquier rol. Devuelve los proveedores
ordenados por `name` con `city` y `state` anidados. Filtros opcionales:
`?state_id=<id>` y `?city_id=<id>` exactos, y `?q=<texto>` para búsqueda parcial
`ILIKE` sobre `name` e `identification`.

```bash
curl "http://localhost:3001/suppliers?state_id=4&q=salud" \
  -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
[
  {
    "id": 1,
    "name": "Distribuidora La Salud C.A.",
    "identification": "J-12345678-9",
    "email": "ventas@lasalud.com",
    "phone": "+58 212 555-1234",
    "observations": "Entrega los martes",
    "address": "Av. Principal, Galpón 4",
    "city_id": 10,
    "state_id": 4,
    "city": { "id": 10, "name": "Maracay" },
    "state": { "id": 4, "name": "Aragua", "code": "VE-D" }
  }
]
```

Errores:

| Código | Cuerpo                                            |
| ------ | ------------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`                   |
| `403`  | `{ "message": "User is blocked" }`                |
| `422`  | `{ "errors": { "state_id": "Invalid state" } }`   |
| `422`  | `{ "errors": { "city_id": "Invalid city id" } }`  |

### `GET /suppliers/:id`

Protegido: requiere un JWT válido, de cualquier rol. Devuelve un proveedor con
`city` y `state` anidados.

```bash
curl http://localhost:3001/suppliers/1 -H "Authorization: Bearer <jwt>"
```

Errores:

| Código | Cuerpo                                           |
| ------ | ------------------------------------------------ |
| `401`  | `{ "message": "Unauthorized" }`                  |
| `403`  | `{ "message": "User is blocked" }`               |
| `404`  | `{ "message": "Supplier not found" }`            |
| `422`  | `{ "errors": { "id": "Invalid supplier id" } }`  |

### `PUT /suppliers/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Actualiza cualquier
subconjunto de los campos editables; al menos uno debe estar presente. Si cambia
`city_id` y no se envía `state_id`, el estado se deriva de la ciudad; si vienen
ambos, se valida la coherencia. Responde `202` con el proveedor actualizado.

```bash
curl -X PUT http://localhost:3001/suppliers/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Distribuidora Central","city_id":10}'
```

Errores:

| Código | Cuerpo                                                                        |
| ------ | ----------------------------------------------------------------------------- |
| `400`  | `{ "message": "At least one field is required" }`                             |
| `401`  | `{ "message": "Unauthorized" }`                                               |
| `403`  | `{ "message": "Forbidden" }`                                                  |
| `404`  | `{ "message": "Supplier not found" }`                                         |
| `409`  | `{ "message": "Supplier already exists" }`                                    |
| `422`  | `{ "errors": { "id": "Invalid supplier id" } }`                               |
| `422`  | `{ "errors": { "city_id": "City does not belong to state" } }`                |

### `DELETE /suppliers/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Elimina el proveedor y
responde `204` sin cuerpo. Si tiene compras asociadas responde `409` con
`{ "message": "Supplier is in use" }` y no lo elimina. La tabla `purchases`
llega con HU-21; hasta entonces la comprobación del repositorio devuelve
`false` y la FK restrictiva queda preparada para el mismo `409`.

```bash
curl -X DELETE http://localhost:3001/suppliers/1 \
  -H "Authorization: Bearer <jwt>"
```

Errores:

| Código | Cuerpo                                           |
| ------ | ------------------------------------------------ |
| `401`  | `{ "message": "Unauthorized" }`                  |
| `403`  | `{ "message": "Forbidden" }`                     |
| `404`  | `{ "message": "Supplier not found" }`            |
| `409`  | `{ "message": "Supplier is in use" }`            |
| `422`  | `{ "errors": { "id": "Invalid supplier id" } }`  |

## Estados de ítem

Los estados de ítem viven en la tabla `item_states` (modelo `ItemState`) y
describen la condición de un producto: vendible, maltratado, vencido, en
cuarentena o reservado. **No deben confundirse con `states` (HU-16)**, que son
los estados geográficos de Venezuela; en este módulo los nombres de archivo,
tabla y variables usan siempre `item_state(s)`.

| Columna       | Tipo        | Restricciones                                  |
| ------------- | ----------- | ---------------------------------------------- |
| `id`          | INTEGER     | PK, autoincremental                            |
| `name`        | STRING(50)  | Requerido, único sin distinguir mayúsculas     |
| `label`       | STRING(100) | Requerido                                      |
| `description` | STRING(255) | Opcional                                       |
| `is_sellable` | BOOLEAN     | Requerido, por defecto `false`                 |
| `createdAt`   | TIMESTAMP   | Auditoría, no se expone en la API              |
| `updatedAt`   | TIMESTAMP   | Auditoría, no se expone en la API              |

`name` es la clave estable (`snake_case`, solo `[a-z0-9_]`, 2–50 caracteres) que
usarán costos, stocks y compras. `label` es el texto visible (2–100
caracteres). `is_sellable` indica si, en principio, un producto en ese estado
puede venderse; no reemplaza validaciones futuras de stock ni precio.

La respuesta pública de un estado de ítem es:

```json
{
  "id": 1,
  "name": "sellable",
  "label": "Vendible",
  "description": null,
  "is_sellable": true
}
```

| Endpoint                 | admin | seller | dispatcher | manager_warehouse | support | customer |
| ------------------------ | ----- | ------ | ---------- | ----------------- | ------- | -------- |
| `POST /item-states`      | ✅    | ✅     | ❌ `403`   | ❌ `403`          | ❌ `403` | ❌ `403` |
| `GET /item-states`       | ✅    | ✅     | ✅         | ✅                | ✅      | ✅       |
| `GET /item-states/:id`   | ✅    | ✅     | ✅         | ✅                | ✅      | ✅       |
| `PUT /item-states/:id`   | ✅    | ✅     | ❌ `403`   | ❌ `403`          | ❌ `403` | ❌ `403` |
| `DELETE /item-states/:id`| ✅    | ✅     | ❌ `403`   | ❌ `403`          | ❌ `403` | ❌ `403` |

### `POST /item-states`

Protegido: requiere un JWT con rol `admin` o `seller`. Crea un estado y
responde `201` con el recurso público. `name` y `label` son obligatorios;
`description` e `is_sellable` son opcionales (`false` por defecto).

```bash
curl -X POST http://localhost:3001/item-states \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "returned",
    "label": "Devuelto",
    "description": "Devuelto por el cliente",
    "is_sellable": false
  }'
```

Errores:

| Código | Cuerpo                                                        |
| ------ | ------------------------------------------------------------- |
| `400`  | `{ "message": "name and label are required" }`                |
| `401`  | `{ "message": "Unauthorized" }`                               |
| `403`  | `{ "message": "Forbidden" }`                                  |
| `409`  | `{ "message": "Item state already exists" }`                  |
| `422`  | `{ "errors": { "name": "name must be snake_case" } }`         |

### `GET /item-states`

Protegido: cualquier usuario autenticado. Devuelve los estados ordenados por
`name` ascendente. El filtro opcional `is_sellable=true|false` es exacto:

```bash
curl "http://localhost:3001/item-states?is_sellable=true" \
  -H "Authorization: Bearer <jwt>"
```

Un valor de filtro distinto de `true` o `false` responde `422` con
`{ "errors": { "is_sellable": "is_sellable must be a boolean" } }`.

### `GET /item-states/:id`

Protegido: cualquier usuario autenticado. Devuelve el detalle o `404` con
`{ "message": "Item state not found" }`. Un id no numérico responde `422` con
`{ "errors": { "id": "Invalid item state id" } }`.

```bash
curl http://localhost:3001/item-states/1 \
  -H "Authorization: Bearer <jwt>"
```

### `PUT /item-states/:id`

Protegido: requiere rol `admin` o `seller`. Acepta cualquier combinación de
`name`, `label`, `description` e `is_sellable` (al menos uno) y responde `202`
con el recurso actualizado. `description: null` borra la descripción.

`name` es la clave estable: solo se puede cambiar si el registro **no** está
referenciado por costos (HU-19), stocks (HU-20) ni ítems de compra (HU-21); si
lo está, responde `409` con `{ "message": "Item state is in use" }`. La
comprobación ya consulta la tabla real `costs` y las claves foráneas
restrictivas cubren el resto de tablas cuando se creen.

```bash
curl -X PUT http://localhost:3001/item-states/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Disponible",
    "description": null,
    "is_sellable": true
  }'
```

Errores: `400` cuando no se envía ningún campo, `401`, `403`, `404`
(`Item state not found`), `409` (`Item state already exists` o
`Item state is in use`) y `422` para campos inválidos.

### `DELETE /item-states/:id`

Protegido: requiere rol `admin` o `seller`. Elimina el estado y responde `204`
sin cuerpo. Si está referenciado por costos, stocks o ítems de compra responde
`409` con `{ "message": "Item state is in use" }` y no lo elimina. La tabla
`costs` ya aplica esa restricción; las claves foráneas restrictivas de stocks y
compras se sumarán con HU-20 y HU-21. Un estado inexistente responde `404` y un
id inválido `422`.

```bash
curl -X DELETE http://localhost:3001/item-states/1 \
  -H "Authorization: Bearer <jwt>"
```

### Semilla de estados de ítem

`npm run db:seed` ejecuta `seeders/20260910000004-item-states.js`, que inserta
de forma idempotente cinco estados:

| `name`       | `label`    | `is_sellable` |
| ------------ | ---------- | ------------- |
| `sellable`   | Vendible   | `true`        |
| `damaged`    | Maltratado | `false`       |
| `expired`    | Vencido    | `false`       |
| `quarantine` | Cuarentena | `false`       |
| `reserved`   | Reservado  | `false`       |

El `down` elimina únicamente esos cinco registros y omite los que ya estén
referenciados por otras tablas.

## Costos

Los costos viven en la tabla `costs` (modelo `Cost`) y guardan **solo el costo
vigente** de un producto para un estado de ítem. El histórico queda en
`purchase_items` (HU-21). La combinación `(product_id, item_state_id)` es única:
un producto tiene un costo por estado.

| Columna         | Tipo          | Restricciones                                   |
| --------------- | ------------- | ----------------------------------------------- |
| `id`            | INTEGER       | PK, autoincremental                             |
| `product_id`    | INTEGER       | Requerido, FK `products.id` con `RESTRICT`      |
| `item_state_id` | INTEGER       | Requerido, FK `item_states.id` con `RESTRICT`   |
| `cost`          | DECIMAL(12,2) | Requerido, `>= 0`                               |
| `createdAt`     | TIMESTAMP     | Auditoría, no se expone en la API               |
| `updatedAt`     | TIMESTAMP     | Auditoría, no se expone en la API               |

`cost` se valida con `yup` (máximo 2 decimales y 9 enteros) y se serializa como
número, nunca como el string que devuelve `DECIMAL`. La respuesta pública es:

```json
{
  "id": 1,
  "product_id": 15,
  "item_state_id": 2,
  "cost": 12.5,
  "item_state": {
    "id": 2,
    "name": "damaged",
    "label": "Maltratado",
    "is_sellable": false
  }
}
```

| Endpoint                     | admin | seller | manager_warehouse | dispatcher | support | customer |
| ---------------------------- | ----- | ------ | ----------------- | ---------- | ------- | -------- |
| `POST /costs`                | ✅    | ✅     | ❌ `403`          | ❌ `403`   | ❌ `403` | ❌ `403` |
| `GET /costs`                 | ✅    | ✅     | ✅                | ❌ `403`   | ❌ `403` | ❌ `403` |
| `GET /costs/:id`             | ✅    | ✅     | ✅                | ❌ `403`   | ❌ `403` | ❌ `403` |
| `GET /costs/product/:id`     | ✅    | ✅     | ✅                | ❌ `403`   | ❌ `403` | ❌ `403` |
| `PUT /costs/:id`             | ✅    | ✅     | ❌ `403`          | ❌ `403`   | ❌ `403` | ❌ `403` |
| `DELETE /costs/:id`          | ✅    | ✅     | ❌ `403`          | ❌ `403`   | ❌ `403` | ❌ `403` |

### `POST /costs`

Protegido: requiere rol `admin` o `seller`. Crea el costo de un producto para
un estado y responde `201`. Los tres campos son obligatorios y el producto y el
estado deben existir.

```bash
curl -X POST http://localhost:3001/costs \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 15,
    "item_state_id": 2,
    "cost": 12.5
  }'
```

Errores:

| Código | Cuerpo                                                              |
| ------ | ------------------------------------------------------------------- |
| `400`  | `{ "message": "product_id, item_state_id and cost are required" }`  |
| `401`  | `{ "message": "Unauthorized" }`                                     |
| `403`  | `{ "message": "Forbidden" }`                                        |
| `409`  | `{ "message": "Cost already exists" }`                              |
| `422`  | `{ "errors": { "product_id": "Invalid product" } }`                 |
| `422`  | `{ "errors": { "item_state_id": "Invalid item state" } }`           |
| `422`  | `{ "errors": { "cost": "cost must be >= 0" } }`                     |
| `422`  | `{ "errors": { "cost": "cost must have at most 2 decimals" } }`     |

### `GET /costs`

Protegido para `admin`, `seller` y `manager_warehouse`. Devuelve los costos
ordenados por `product_id` y `item_state_id` ascendente. Los filtros
`?product_id=` y `?item_state_id=` son opcionales y exactos; un valor inválido
responde `422`.

```bash
curl "http://localhost:3001/costs?product_id=15&item_state_id=2" \
  -H "Authorization: Bearer <jwt>"
```

### `GET /costs/:id` y `GET /costs/product/:product_id`

`GET /costs/:id` devuelve el detalle o `404` con
`{ "message": "Cost not found" }`. `GET /costs/product/:product_id` devuelve
todos los costos del producto, uno por estado y ordenados por `item_state_id`;
si no hay ninguno responde `200` con `[]` (no `404`).

```bash
curl http://localhost:3001/costs/1 \
  -H "Authorization: Bearer <jwt>"

curl http://localhost:3001/costs/product/15 \
  -H "Authorization: Bearer <jwt>"
```

Un id no numérico responde `422` con `{ "errors": { "id": "Invalid cost id" } }`
y un producto no numérico con
`{ "errors": { "product_id": "Invalid product id" } }`.

### `PUT /costs/:id`

Protegido: requiere rol `admin` o `seller`. Acepta cualquier combinación de
`cost`, `product_id` e `item_state_id` (al menos uno) y responde `202` con el
recurso actualizado. Las referencias nuevas deben existir y la combinación
resultante debe seguir siendo única; si ya existe, responde `409`.

```bash
curl -X PUT http://localhost:3001/costs/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "cost": 20,
    "item_state_id": 1
  }'
```

Errores: `400` cuando no se envía ningún campo, `401`, `403`, `404`
(`Cost not found`), `409` (`Cost already exists`) y `422` para un id, campo o
referencia inválidos.

### `DELETE /costs/:id`

Protegido: requiere rol `admin` o `seller`. Elimina el costo y responde `204`
sin cuerpo. No modifica productos, estados, compras ni stocks. Un costo
inexistente responde `404` y un id inválido `422`.

```bash
curl -X DELETE http://localhost:3001/costs/1 \
  -H "Authorization: Bearer <jwt>"
```

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

## CI/CD (GitHub Actions)

El pipeline vive en `.github/workflows/ci.yml` y tiene tres jobs:

| Job      | Cuándo corre         | Qué hace                                                              |
| -------- | -------------------- | --------------------------------------------------------------------- |
| `test`   | Push y pull request  | `npm test` y `npm run test:integration` contra un servicio Postgres.  |
| `build`  | Solo tags (`v1.2.3`) | Construye y publica en Docker Hub la imagen con el tag y `latest`.    |
| `deploy` | Solo tags            | Despliega en la VM, corre migraciones/seeders y valida el contenedor. |

Para desplegar una versión basta con crear un tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Secrets y variables requeridos en GitHub (Settings → Secrets and variables →
Actions):

| Nombre                                                    | Tipo   | Uso                                                 |
| --------------------------------------------------------- | ------ | --------------------------------------------------- |
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`                   | Secret | Credenciales de Docker Hub.                         |
| `DOCKERHUB_IMAGE`                                         | Var    | Nombre de la imagen, p. ej. `api-farmamad-express`. |
| `VM_HOSTNAME`, `VM_PORT`, `VM_USERNAME`, `VM_PASSWORD`    | Secret | Acceso SSH a la VM de despliegue.                   |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Secret | Base de datos de producción.                        |
| `JWT_SECRET`, `JWT_EXPIRES_IN`                            | Secret | Configuración de autenticación.                     |
| `GMAIL_USERNAME`, `GMAIL_TOKEN`                           | Secret | Envío de correos de recuperación.                   |
| `LOG_LEVEL`                                               | Var    | Nivel de logs del contenedor (opcional).            |

El contenedor se llama `bread-king-api`, se une a la red `maseferlat` y se
recrea con `/app/create-container`; el healthcheck final usa `/app/check-container`.
