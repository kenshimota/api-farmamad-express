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
`JWT_EXPIRES_IN`, `CORS_ORIGIN`, `GMAIL_USERNAME`, `GMAIL_TOKEN`, `APP_NAME`,
`APP_URL`, `UPLOAD_DIR` y `PUBLIC_BASE_URL` (ver `.env.example`).

`UPLOAD_DIR` es la carpeta raíz de los archivos subidos (por defecto
`<repo>/uploads`) y `PUBLIC_BASE_URL` es la base usada para construir las URLs
públicas de las imágenes (por defecto `http://localhost:${PORT || 3001}`).

`APP_NAME` es el nombre del producto que aparece en los correos (por defecto
`Farmamed`) y `APP_URL` es el link de ingreso incluido en el correo de
bienvenida (por defecto `https://farmamed.strixcryptoapp.site/app`). Si cualquiera
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
    "isBlocked": false,
    "customer_id": null,
    "customer": null
  }
}
```

Cuando la cuenta está vinculada a un cliente, `customer_id` lleva el id y
`customer` el resumen público del cliente:

```json
{
  "customer_id": 8,
  "customer": {
    "id": 8,
    "fullName": "Cliente Demo",
    "latitude": -17.7833,
    "longitude": -63.1821,
    "direction": "Av. Monseñor Rivero 123",
    "email": "cliente@example.com"
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
`role` y, cuando existe, el vínculo con su cliente. La asociación `customer` se
carga en la misma consulta que el usuario, sin consultas N+1.

```bash
curl http://localhost:3001/auth/me -H "Authorization: Bearer <jwt>"
```

Respuesta `200` con un cliente vinculado:

```json
{
  "id": 12,
  "username": "cliente",
  "email": "cliente@example.com",
  "name": "Cliente Demo",
  "role": "customer",
  "isBlocked": false,
  "customer_id": 8,
  "customer": {
    "id": 8,
    "fullName": "Cliente Demo",
    "latitude": -17.7833,
    "longitude": -63.1821,
    "direction": "Av. Monseñor Rivero 123",
    "email": "cliente@example.com"
  }
}
```

Sin vínculo, `customer_id` y `customer` son `null`. El resumen solo incluye
`id`, `fullName`, `email`, `direction`, `latitude` y `longitude`: nunca
`isRegistered`, `createdAt` ni `updatedAt`.

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
(requeridos); `name` y `customer_id` (opcionales). Si `username` o `email` ya
existen responde `409`; si el rol no existe en el catálogo (por ejemplo
`delivery`, `freelance_delivery` o cualquier otro valor) responde `422` con
`{ "errors": { "role": "Invalid role" } }`.

`customer_id` solo se acepta cuando `role` es `customer`: el cliente debe
existir y no puede estar vinculado a otra cuenta. La cuenta y el vínculo se
crean en una sola operación, de modo que si el vínculo falla no queda un usuario
a medias.

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

Con vínculo a un cliente:

```bash
curl -X POST http://localhost:3001/users \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"username":"cliente","email":"cliente@example.com","password":"secreto123","name":"Cliente Demo","role":"customer","customer_id":8}'
```

Respuesta `201`:

```json
{
  "id": 12,
  "username": "cliente",
  "email": "cliente@example.com",
  "name": "Cliente Demo",
  "role": "customer",
  "isBlocked": false,
  "customer_id": 8,
  "customer": {
    "id": 8,
    "fullName": "Cliente Demo",
    "latitude": -17.7833,
    "longitude": -63.1821,
    "direction": "Av. Monseñor Rivero 123",
    "email": "cliente@example.com"
  }
}
```

Errores:

| Código | Cuerpo                                                             |
| ------ | ------------------------------------------------------------------ |
| `400`  | `{ "message": "username, email, password and role are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                                    |
| `403`  | `{ "message": "Forbidden" }`                                       |
| `409`  | `{ "message": "User already exists" }`                             |
| `409`  | `{ "message": "Customer is already linked to a user" }`            |
| `422`  | `{ "errors": { "role": "Invalid role" } }`                         |
| `422`  | `{ "errors": { "customer_id": "User is not a customer" } }`        |
| `422`  | `{ "errors": { "customer_id": "Invalid customer" } }`              |
| `422`  | `{ "errors": { "customer_id": "Invalid customer id" } }`           |

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

### `PUT /users/:id/customer`

Protegido: requiere un JWT con rol `admin`. Vincula la cuenta indicada con un
cliente (`{ "customer_id": 8 }`) o elimina el vínculo (`{ "customer_id": null }`).
El usuario debe tener rol `customer`, el cliente debe existir y solo una cuenta
puede estar vinculada a cada cliente. Reenviar el mismo `customer_id` es
idempotente. Responde `202` con los datos públicos del usuario actualizado.

```bash
curl -X PUT http://localhost:3001/users/12/customer \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":8}'
```

Respuesta `202`:

```json
{
  "id": 12,
  "username": "cliente",
  "email": "cliente@example.com",
  "name": "Cliente Demo",
  "role": "customer",
  "isBlocked": false,
  "customer_id": 8,
  "customer": {
    "id": 8,
    "fullName": "Cliente Demo",
    "latitude": -17.7833,
    "longitude": -63.1821,
    "direction": "Av. Monseñor Rivero 123",
    "email": "cliente@example.com"
  }
}
```

Para desvincular:

```bash
curl -X PUT http://localhost:3001/users/12/customer \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":null}'
```

La respuesta `202` conserva los datos del usuario con `customer_id: null` y
`customer: null`. El endpoint no cambia el rol de la cuenta ni crea clientes.

Errores:

| Código | Cuerpo                                                       |
| ------ | ------------------------------------------------------------ |
| `400`  | `{ "message": "customer_id is required" }`                   |
| `401`  | `{ "message": "Unauthorized" }`                              |
| `403`  | `{ "message": "Forbidden" }`                                 |
| `404`  | `{ "message": "User not found" }`                            |
| `409`  | `{ "message": "Customer is already linked to a user" }`      |
| `422`  | `{ "errors": { "id": "Invalid user id" } }`                  |
| `422`  | `{ "errors": { "customer_id": "User is not a customer" } }`  |
| `422`  | `{ "errors": { "customer_id": "Invalid customer" } }`        |
| `422`  | `{ "errors": { "customer_id": "Invalid customer id" } }`     |

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
`createdAt`, `updatedAt` ni `isRegistered`. Todas las respuestas incluyen
`price_list_id` (número o `null`) y `price_list` con la forma `{ id, name }` (o
`null`) cuando el cliente tiene una lista asignada; el porcentaje y la
descripción de la lista nunca se exponen. También incluyen `payment_term_id` y
`payment_term` con la forma `{ id, code, name, days }` (o `null`) cuando el
cliente tiene un término de pago por defecto (HU-41).

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
la tabla pero no se expone en la respuesta. El campo opcional `price_list_id`
asigna una lista de precios existente al cliente. El campo opcional
`payment_term_id` asigna un término de pago activo; si el término no existe o
está inactivo responde `422` con
`{ "errors": { "payment_term_id": "Invalid payment term" } }`.

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
  "email": "juan@example.com",
  "price_list_id": null,
  "price_list": null,
  "payment_term_id": null,
  "payment_term": null
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
| `422`  | `{ "errors": { "price_list_id": "Invalid price list" } }`                          |
| `422`  | `{ "errors": { "payment_term_id": "Invalid payment term" } }`                      |

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
    "email": "juan@example.com",
    "price_list_id": null,
    "price_list": null
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
  "email": "juan@example.com",
  "price_list_id": null,
  "price_list": null,
  "payment_term_id": null,
  "payment_term": null
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
conserva su valor anterior. `price_list_id` también es opcional: si se omite
conserva la lista actual, si llega `null` limpia la asignación y si llega un
entero reemplaza la lista. `payment_term_id` funciona igual: si se omite
conserva el término, `null` lo limpia y un entero lo reemplaza cuando el
término existe y está activo.

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
  "email": "juan@example.com",
  "price_list_id": null,
  "price_list": null,
  "payment_term_id": null,
  "payment_term": null
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

## Listas de precios

Las listas viven en la tabla `price_lists` (modelo `PriceList`) y guardan un
`name` único sin distinguir mayúsculas, una `description` opcional y un
`percentage` de margen sobre el costo real. Cada cliente puede tener a lo sumo
una lista mediante `customers.price_list_id`; la columna es nullable por
compatibilidad, pero para vender el cliente debe tener una lista asignada.

Permisos por endpoint (lectura y escritura):

| Endpoint                | `admin` | `seller` | `dispatcher` | `manager_warehouse` | `support` | `customer` |
| ----------------------- | ------- | -------- | ------------ | ------------------- | --------- | ---------- |
| `POST /price-lists`     | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `GET /price-lists`      | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `GET /price-lists/:id`  | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `PUT /price-lists/:id`  | ✅      | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `DELETE /price-lists/:id` | ✅    | ✅       | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |

### `POST /price-lists`

Protegido: requiere un JWT con rol `admin` o `seller`. `name` y `percentage`
son obligatorios; `description` es opcional y se guarda como `null` si llega
vacía. `percentage` debe ser un número finito en `[0, 100)` con máximo dos
decimales.

```bash
curl -X POST http://localhost:3001/price-lists \
  -H "Authorization: Bearer <jwt-admin>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Mayorista 30","description":"Margen del 30 % para mayoristas","percentage":30}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "name": "Mayorista 30",
  "description": "Margen del 30 % para mayoristas",
  "percentage": 30
}
```

Errores:

| Código | Cuerpo                                                                |
| ------ | --------------------------------------------------------------------- |
| `400`  | `{ "message": "name and percentage are required" }`                    |
| `401`  | `{ "message": "Unauthorized" }`                                       |
| `403`  | `{ "message": "Forbidden" }` o `{ "message": "User is blocked" }`     |
| `409`  | `{ "message": "Price list already exists" }`                          |
| `422`  | `{ "errors": { "name": "Nombre inválido" } }`                         |
| `422`  | `{ "errors": { "percentage": "Invalid percentage" } }`                |
| `422`  | `{ "errors": { "percentage": "percentage must be < 100" } }`          |

### `GET /price-lists`

Protegido: requiere un JWT con rol `admin` o `seller`. Devuelve todas las listas
ordenadas por `name` ascendente y luego por `id` ascendente.

```bash
curl http://localhost:3001/price-lists -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
[
  {
    "id": 1,
    "name": "Mayorista 30",
    "description": "Margen del 30 % para mayoristas",
    "percentage": 30
  }
]
```

### `GET /price-lists/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Devuelve una lista o
`404` si no existe.

```bash
curl http://localhost:3001/price-lists/1 -H "Authorization: Bearer <jwt>"
```

Errores:

| Código | Cuerpo                                              |
| ------ | --------------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`                     |
| `403`  | `{ "message": "Forbidden" }`                        |
| `404`  | `{ "message": "Price list not found" }`             |
| `422`  | `{ "errors": { "id": "Invalid price list id" } }`   |

### `PUT /price-lists/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Es un reemplazo completo:
`name` y `percentage` son obligatorios y `description` se guarda como `null`
cuando se omite. Responde `202` con la lista actualizada.

```bash
curl -X PUT http://localhost:3001/price-lists/1 \
  -H "Authorization: Bearer <jwt-admin>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Mayorista 35","description":"Margen del 35 %","percentage":35}'
```

### `DELETE /price-lists/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Si la lista está asignada
a al menos un cliente responde `409` con `{ "message": "Price list is in use" }`.
Si no está asignada responde `204` sin cuerpo.

### Asignación a clientes

`POST /customers` y `PUT /customers/:id` aceptan `price_list_id` opcional. En la
actualización, omitirlo conserva la lista actual, `null` la limpia y un entero la
reemplaza. Un `price_list_id` inexistente responde `422` con
`{ "errors": { "price_list_id": "Invalid price list" } }`.

```bash
curl -X PUT http://localhost:3001/customers/8 \
  -H "Authorization: Bearer <jwt-admin>" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Cliente Demo","latitude":-17.7833,"longitude":-63.1821,"direction":"Av. Monseñor Rivero 123","email":"cliente@example.com","price_list_id":1}'
```

Respuesta `202`:

```json
{
  "id": 8,
  "fullName": "Cliente Demo",
  "latitude": -17.7833,
  "longitude": -63.1821,
  "direction": "Av. Monseñor Rivero 123",
  "email": "cliente@example.com",
  "price_list_id": 1,
  "price_list": { "id": 1, "name": "Mayorista 30" }
}
```

### Cálculo del precio de compra

El módulo compartido `src/pricing/` resuelve el precio a partir del costo real y
el margen de la lista del cliente. Recibe `product_id`, `item_state_id`,
`price_list_id` y la moneda de transacción (por defecto, la moneda activa
marcada para transacciones):

```text
precio_con_margen = costs.cost / (1 - price_lists.percentage / 100)
precio_final = round2(precio_con_margen × costoMoneda.rate ÷ transaccionMoneda.rate)
```

Con un costo de `10.00` USD, `percentage = 30` y la misma moneda de transacción:

```text
precio = 10.00 / (1 - 0.30) = 14.2857...
precio final = 14.29
```

Reglas del resolvedor:

- el estado de ítem debe existir y tener `is_sellable = true`; si no, responde
  `422` con `{ "errors": { "item_state_id": "Invalid item state" } }`;
- si el cliente no tiene lista responde `403` con
  `{ "message": "Customer price list is not assigned" }`;
- un producto sin costo, con costo negativo o con moneda inexistente/inactiva
  responde `422` con
  `{ "errors": { "product_id": "Product has no price for this item state and price list" } }`;
- un precio mayor a `9999999999.99` responde `422` con
  `{ "errors": { "product_id": "Price out of range" } }`;
- si no hay moneda activa por defecto para transacciones responde `503` con
  `{ "message": "Default transaction currency is not configured" }`.

El cálculo es dinámico y no usa `products.sale_price` ni `products.currency_id`.
Los pedidos que lo consuman deben congelar `unit_price` y `subtotal` al momento
de solicitarlos.

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
obligatoria, única y de hasta 100 caracteres. `category_id` referencia
`categories.id` e `image_id` referencia `images.id`; ambas FKs usan
`ON DELETE RESTRICT`, así que no se puede borrar una categoría o una imagen que
tenga productos asociados. Al crear o editar se debe enviar un archivo `image`
(`multipart/form-data`) o un `image_id` ya registrado, nunca ambos. Con archivo,
la API crea la fila de `images` automáticamente. Los textos se recortan antes de
guardarse. Ninguna respuesta incluye `createdAt` ni `updatedAt`: solo se exponen
`id`, `name`, `description`, `reference`, `category_id` e `image_id`.

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

Protegido: requiere un JWT con rol `admin` o `seller`. Acepta JSON o
`multipart/form-data`; los campos requeridos son `name`, `description`,
`reference` y `category_id`, y además debe enviarse `image` (archivo) o
`image_id` (imagen ya registrada), nunca ambos. Los campos desconocidos y de
auditoría se descartan. Antes de insertar se verifica que la categoría exista y,
cuando no hay archivo, que la imagen exista. La restricción única de `reference`
y las FKs de Postgres actúan como salvaguarda ante peticiones concurrentes.

Con `multipart/form-data` el campo de archivo se llama `image`. Se aceptan
JPEG, PNG y WebP reales de hasta 5 MB, 6000 × 6000 px y 25 megapíxeles; el tipo
se detecta con el contenido, no con el `Content-Type` ni con el nombre enviado.
El original y la miniatura WebP (máximo 320 × 320 px, sin ampliar) se guardan en
`${UPLOAD_DIR}/products/` con nombres UUID. La fila de `images` se crea dentro de
una transacción junto con el producto; si la inserción falla se revierte la
transacción y se eliminan los archivos escritos.

```bash
curl -X POST http://localhost:3001/products \
  -H "Authorization: Bearer <jwt-admin>" \
  -F "name=Ibuprofeno 400 mg" \
  -F "description=Analgésico y antiinflamatorio" \
  -F "reference=IBU-400" \
  -F "category_id=1" \
  -F "image=@./ibuprofeno.png"
```

La fila de `images` generada contiene `reference` `product-<uuid>`, `pathname`
`/uploads/products/<uuid>.<ext>`, `url`
`${PUBLIC_BASE_URL}/uploads/products/<uuid>.<ext>` y `thumbnail`
`${PUBLIC_BASE_URL}/uploads/products/<uuid>-thumb.webp`. Los archivos públicos se
sirven en `/uploads` sin listado de directorios.

El flujo JSON con `image_id` sigue disponible:

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
  "image_id": 7
}
```

Errores:

| Código | Cuerpo                                                                 |
| ------ | ---------------------------------------------------------------------- |
| `400`  | `{ "message": "image or image_id is required" }`                       |
| `400`  | `{ "message": "Unexpected field" }`                                    |
| `401`  | `{ "message": "Unauthorized" }`                                        |
| `403`  | `{ "message": "Forbidden" }`                                           |
| `409`  | `{ "message": "Product already exists" }`                              |
| `413`  | `{ "message": "Image too large" }`                                     |
| `422`  | `{ "errors": { "image_id": "image_id cannot be combined with image" } }` |
| `422`  | `{ "errors": { "image": "Invalid image" } }`                           |
| `422`  | `{ "errors": { "image": "Invalid image dimensions" } }`                |
| `422`  | `{ "errors": { "category_id": "Invalid category id" } }`               |
| `422`  | `{ "errors": { "image_id": "Invalid image id" } }`                     |
| `500`  | `{ "message": "Internal server error" }`                               |

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

Protegido: requiere un JWT con rol `admin` o `seller`. Reemplaza el recurso,
acepta JSON o `multipart/form-data` y exige `name`, `description`, `reference` y
`category_id`, más `image` o `image_id`. Con archivo se crea una nueva fila de
`images` y se reemplaza `products.image_id`; la imagen anterior y sus archivos no
se eliminan porque pueden estar compartidos. Con `image_id` se conserva el flujo
JSON. Los campos numéricos enviados como texto en multipart se convierten antes
de validar.

```bash
curl -X PUT http://localhost:3001/products/1 \
  -H "Authorization: Bearer <jwt-admin>" \
  -F "name=Ibuprofeno 800 mg" \
  -F "description=Analgésico y antiinflamatorio" \
  -F "reference=IBU-800" \
  -F "category_id=1" \
  -F "image=@./ibuprofeno-800.png"
```

También sigue funcionando con `image_id`:

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
  "image_id": 7
}
```

Errores:

| Código | Cuerpo                                                                 |
| ------ | ---------------------------------------------------------------------- |
| `400`  | `{ "message": "image or image_id is required" }`                       |
| `400`  | `{ "message": "Unexpected field" }`                                    |
| `401`  | `{ "message": "Unauthorized" }`                                        |
| `403`  | `{ "message": "Forbidden" }`                                           |
| `404`  | `{ "message": "Product not found" }`                                   |
| `409`  | `{ "message": "Product already exists" }`                              |
| `413`  | `{ "message": "Image too large" }`                                     |
| `422`  | `{ "errors": { "id": "Invalid product id" } }`                         |
| `422`  | `{ "errors": { "image_id": "image_id cannot be combined with image" } }` |
| `422`  | `{ "errors": { "image": "Invalid image" } }`                           |
| `422`  | `{ "errors": { "image": "Invalid image dimensions" } }`                |
| `422`  | `{ "errors": { "category_id": "Invalid category id" } }`               |
| `422`  | `{ "errors": { "image_id": "Invalid image id" } }`                     |
| `500`  | `{ "message": "Internal server error" }`                               |

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
| `409`  | `{ "message": "Product is in use" }`           |
| `422`  | `{ "errors": { "id": "Invalid product id" } }` |

Un producto referenciado por un costo o por una fila de inventario responde
`409` con `{ "message": "Product is in use" }` y no se elimina: las claves
foráneas `products` → `costs` y `products` → `stocks` son `RESTRICT`.

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

| Código | Cuerpo                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------- |
| `400`  | `{ "message": "name, identification, email, phone, address, city_id and state_id are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                                                                   |
| `403`  | `{ "message": "Forbidden" }`                                                                      |
| `409`  | `{ "message": "Supplier already exists" }`                                                        |
| `422`  | `{ "errors": { "city_id": "Invalid city id" } }`                                                  |
| `422`  | `{ "errors": { "state_id": "Invalid state" } }`                                                   |
| `422`  | `{ "errors": { "city_id": "City does not belong to state" } }`                                    |

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

| Código | Cuerpo                                           |
| ------ | ------------------------------------------------ |
| `401`  | `{ "message": "Unauthorized" }`                  |
| `403`  | `{ "message": "User is blocked" }`               |
| `422`  | `{ "errors": { "state_id": "Invalid state" } }`  |
| `422`  | `{ "errors": { "city_id": "Invalid city id" } }` |

### `GET /suppliers/:id`

Protegido: requiere un JWT válido, de cualquier rol. Devuelve un proveedor con
`city` y `state` anidados.

```bash
curl http://localhost:3001/suppliers/1 -H "Authorization: Bearer <jwt>"
```

Errores:

| Código | Cuerpo                                          |
| ------ | ----------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`                 |
| `403`  | `{ "message": "User is blocked" }`              |
| `404`  | `{ "message": "Supplier not found" }`           |
| `422`  | `{ "errors": { "id": "Invalid supplier id" } }` |

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

| Código | Cuerpo                                                         |
| ------ | -------------------------------------------------------------- |
| `400`  | `{ "message": "At least one field is required" }`              |
| `401`  | `{ "message": "Unauthorized" }`                                |
| `403`  | `{ "message": "Forbidden" }`                                   |
| `404`  | `{ "message": "Supplier not found" }`                          |
| `409`  | `{ "message": "Supplier already exists" }`                     |
| `422`  | `{ "errors": { "id": "Invalid supplier id" } }`                |
| `422`  | `{ "errors": { "city_id": "City does not belong to state" } }` |

### `DELETE /suppliers/:id`

Protegido: requiere un JWT con rol `admin` o `seller`. Elimina el proveedor y
responde `204` sin cuerpo. Si tiene compras asociadas responde `409` con
`{ "message": "Supplier is in use" }` y no lo elimina. La comprobación consulta
`purchases.supplier_id` y la FK restrictiva actúa como salvaguarda final.

```bash
curl -X DELETE http://localhost:3001/suppliers/1 \
  -H "Authorization: Bearer <jwt>"
```

Errores:

| Código | Cuerpo                                          |
| ------ | ----------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`                 |
| `403`  | `{ "message": "Forbidden" }`                    |
| `404`  | `{ "message": "Supplier not found" }`           |
| `409`  | `{ "message": "Supplier is in use" }`           |
| `422`  | `{ "errors": { "id": "Invalid supplier id" } }` |

## Estados de ítem

Los estados de ítem viven en la tabla `item_states` (modelo `ItemState`) y
describen la condición de un producto: vendible, maltratado, vencido, en
cuarentena o reservado. **No deben confundirse con `states` (HU-16)**, que son
los estados geográficos de Venezuela; en este módulo los nombres de archivo,
tabla y variables usan siempre `item_state(s)`.

| Columna       | Tipo        | Restricciones                              |
| ------------- | ----------- | ------------------------------------------ |
| `id`          | INTEGER     | PK, autoincremental                        |
| `name`        | STRING(50)  | Requerido, único sin distinguir mayúsculas |
| `label`       | STRING(100) | Requerido                                  |
| `description` | STRING(255) | Opcional                                   |
| `is_sellable` | BOOLEAN     | Requerido, por defecto `false`             |
| `createdAt`   | TIMESTAMP   | Auditoría, no se expone en la API          |
| `updatedAt`   | TIMESTAMP   | Auditoría, no se expone en la API          |

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

| Endpoint                  | admin | seller | dispatcher | manager_warehouse | support  | customer |
| ------------------------- | ----- | ------ | ---------- | ----------------- | -------- | -------- |
| `POST /item-states`       | ✅    | ✅     | ❌ `403`   | ❌ `403`          | ❌ `403` | ❌ `403` |
| `GET /item-states`        | ✅    | ✅     | ✅         | ✅                | ✅       | ✅       |
| `GET /item-states/:id`    | ✅    | ✅     | ✅         | ✅                | ✅       | ✅       |
| `PUT /item-states/:id`    | ✅    | ✅     | ❌ `403`   | ❌ `403`          | ❌ `403` | ❌ `403` |
| `DELETE /item-states/:id` | ✅    | ✅     | ❌ `403`   | ❌ `403`          | ❌ `403` | ❌ `403` |

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

| Código | Cuerpo                                                |
| ------ | ----------------------------------------------------- |
| `400`  | `{ "message": "name and label are required" }`        |
| `401`  | `{ "message": "Unauthorized" }`                       |
| `403`  | `{ "message": "Forbidden" }`                          |
| `409`  | `{ "message": "Item state already exists" }`          |
| `422`  | `{ "errors": { "name": "name must be snake_case" } }` |

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
comprobación consulta las tablas `costs`, `stocks` y `purchase_items`; las
claves foráneas restrictivas son la salvaguarda final ante concurrencia.

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
`409` con `{ "message": "Item state is in use" }` y no lo elimina. Las tablas
`costs`, `stocks` y `purchase_items` aplican esa restricción. Un estado
inexistente responde `404` y un id inválido `422`.

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

| Columna         | Tipo          | Restricciones                                 |
| --------------- | ------------- | --------------------------------------------- |
| `id`            | INTEGER       | PK, autoincremental                           |
| `product_id`    | INTEGER       | Requerido, FK `products.id` con `RESTRICT`    |
| `item_state_id` | INTEGER       | Requerido, FK `item_states.id` con `RESTRICT` |
| `cost`          | DECIMAL(12,2) | Requerido, `>= 0`                             |
| `currency_id`   | INTEGER       | Requerido, FK `currencies.id` con `RESTRICT`  |
| `createdAt`     | TIMESTAMP     | Auditoría, no se expone en la API             |
| `updatedAt`     | TIMESTAMP     | Auditoría, no se expone en la API             |

`cost` se valida con `yup` (máximo 2 decimales y 9 enteros) y se serializa como
número, nunca como el string que devuelve `DECIMAL`. La respuesta pública es:

```json
{
  "id": 1,
  "product_id": 15,
  "item_state_id": 2,
  "cost": 12.5,
  "currency_id": 3,
  "currency": {
    "id": 3,
    "code": "USD_BCV",
    "name": "Dólar BCV",
    "symbol": "$"
  },
  "item_state": {
    "id": 2,
    "name": "damaged",
    "label": "Maltratado",
    "is_sellable": false
  }
}
```

`cost` está expresado en la moneda indicada por `currency_id`. Si el cliente no
la envía, se usa la moneda por defecto para transacciones (`USD_BCV`). No hay
conversión automática: cambiar la moneda conserva el valor numérico.

| Endpoint                 | admin | seller | manager_warehouse | dispatcher | support  | customer |
| ------------------------ | ----- | ------ | ----------------- | ---------- | -------- | -------- |
| `POST /costs`            | ✅    | ✅     | ❌ `403`          | ❌ `403`   | ❌ `403` | ❌ `403` |
| `GET /costs`             | ✅    | ✅     | ✅                | ❌ `403`   | ❌ `403` | ❌ `403` |
| `GET /costs/:id`         | ✅    | ✅     | ✅                | ❌ `403`   | ❌ `403` | ❌ `403` |
| `GET /costs/product/:id` | ✅    | ✅     | ✅                | ❌ `403`   | ❌ `403` | ❌ `403` |
| `PUT /costs/:id`         | ✅    | ✅     | ❌ `403`          | ❌ `403`   | ❌ `403` | ❌ `403` |
| `DELETE /costs/:id`      | ✅    | ✅     | ❌ `403`          | ❌ `403`   | ❌ `403` | ❌ `403` |

### `POST /costs`

Protegido: requiere rol `admin` o `seller`. Crea el costo de un producto para
un estado y responde `201`. `product_id`, `item_state_id` y `cost` son
obligatorios; `currency_id` es opcional y, si se omite, se usa la moneda por
defecto para transacciones. El producto, el estado y la moneda deben existir (la
moneda además debe estar activa).

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

Con moneda explícita:

```bash
curl -X POST http://localhost:3001/costs \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 15,
    "item_state_id": 2,
    "cost": 12.5,
    "currency_id": 1
  }'
```

Errores:

| Código | Cuerpo                                                             |
| ------ | ------------------------------------------------------------------ |
| `400`  | `{ "message": "product_id, item_state_id and cost are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                                    |
| `403`  | `{ "message": "Forbidden" }`                                       |
| `409`  | `{ "message": "Cost already exists" }`                             |
| `422`  | `{ "errors": { "product_id": "Invalid product" } }`                |
| `422`  | `{ "errors": { "item_state_id": "Invalid item state" } }`          |
| `422`  | `{ "errors": { "cost": "cost must be >= 0" } }`                    |
| `422`  | `{ "errors": { "cost": "cost must have at most 2 decimals" } }`    |
| `422`  | `{ "errors": { "currency_id": "Invalid currency" } }`              |
| `503`  | `{ "message": "Default transaction currency is not configured" }`  |

### `GET /costs`

Protegido para `admin`, `seller` y `manager_warehouse`. Devuelve los costos
ordenados por `product_id` y `item_state_id` ascendente. Los filtros
`?product_id=`, `?item_state_id=` y `?currency_id=` son opcionales y exactos;
un valor inválido responde `422`.

```bash
curl "http://localhost:3001/costs?product_id=15&item_state_id=2&currency_id=3" \
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
`cost`, `product_id`, `item_state_id` y `currency_id` (al menos uno) y responde
`202` con el recurso actualizado. Cambiar `currency_id` **no convierte** el
valor de `cost`: el número se conserva y pasa a interpretarse en la nueva
moneda. Las referencias nuevas deben existir (la moneda debe estar activa) y la
combinación resultante debe seguir siendo única; si ya existe, responde `409`.

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

## Inventario (stocks)

El inventario vive en la tabla `stocks` (modelo `Stock`) y guarda **una fila
por combinación `(product_id, item_state_id)`** con la cantidad disponible. En
esta historia la API es de **solo lectura**: las filas se crean y se incrementan
automáticamente al confirmar compras (HU-21), no mediante endpoints públicos.

| Columna         | Tipo      | Restricciones                                 |
| --------------- | --------- | --------------------------------------------- |
| `id`            | INTEGER   | PK, autoincremental                           |
| `product_id`    | INTEGER   | Requerido, FK `products.id` con `RESTRICT`    |
| `item_state_id` | INTEGER   | Requerido, FK `item_states.id` con `RESTRICT` |
| `quantity`      | INTEGER   | Requerido, `>= 0`, por defecto `0`            |
| `createdAt`     | TIMESTAMP | Auditoría, no se expone en la API             |
| `updatedAt`     | TIMESTAMP | Auditoría, no se expone en la API             |

La restricción única `(product_id, item_state_id)` impide duplicados y el
`CHECK (quantity >= 0)` impide cantidades negativas. La respuesta pública de
`GET /stocks` es:

```json
{
  "id": 3,
  "product_id": 15,
  "item_state_id": 1,
  "quantity": 40,
  "item_state": {
    "id": 1,
    "name": "sellable",
    "label": "Vendible",
    "is_sellable": true
  }
}
```

| Endpoint                            | admin | seller | manager_warehouse | dispatcher | support  | customer |
| ----------------------------------- | ----- | ------ | ----------------- | ---------- | -------- | -------- |
| `GET /stocks`                       | ✅    | ✅     | ✅                | ❌ `403`   | ❌ `403` | ❌ `403` |
| `GET /stocks/:id`                   | ✅    | ✅     | ✅                | ❌ `403`   | ❌ `403` | ❌ `403` |
| `GET /stocks/product/:product_id`   | ✅    | ✅     | ✅                | ❌ `403`   | ❌ `403` | ❌ `403` |
| `GET /stocks/available`             | ✅    | ✅     | ✅                | ❌ `403`   | ❌ `403` | ❌ `403` |
| `GET /stocks/available/:product_id` | ✅    | ✅     | ✅                | ❌ `403`   | ❌ `403` | ❌ `403` |

No existe `POST`, `PUT` ni `DELETE` público para `stocks`; esas rutas responden
`404`.

### `GET /stocks`

Protegido para `admin`, `seller` y `manager_warehouse`. Devuelve el inventario
ordenado por `product_id` y `item_state_id` ascendente, con el estado anidado.
Los filtros son opcionales y exactos: `?product_id=`, `?item_state_id=` y
`?in_stock=true|false` (`true` deja solo `quantity > 0`). Un filtro inválido
responde `422` con `{ "errors": { "product_id": "Invalid id" } }`.

```bash
curl "http://localhost:3001/stocks?product_id=15&in_stock=true" \
  -H "Authorization: Bearer <jwt>"
```

### `GET /stocks/:id` y `GET /stocks/product/:product_id`

`GET /stocks/:id` devuelve el detalle o `404` con
`{ "message": "Stock not found" }`; un id no numérico responde `422` con
`{ "errors": { "id": "Invalid stock id" } }`. `GET /stocks/product/:product_id`
devuelve todos los estados del producto, ordenados por `item_state_id`; si no
hay filas responde `200` con `[]`, incluso si el producto no existe.

```bash
curl http://localhost:3001/stocks/1 \
  -H "Authorization: Bearer <jwt>"

curl http://localhost:3001/stocks/product/15 \
  -H "Authorization: Bearer <jwt>"
```

### `GET /stocks/available`

Protegido para `admin`, `seller` y `manager_warehouse`. Requiere
`?product_id=` y devuelve solo las filas con `quantity > 0` cuyo estado tiene
`is_sellable = true`, ordenadas por `item_state.name`. Cada fila incluye el
costo vigente de `costs` para la misma combinación o `cost: null` si no existe;
también incluye `currency_id` y `currency` del costo, o ambos en `null` cuando
no hay costo. La fila **no se oculta** para que el faltante sea visible. La
consulta cruza `stocks`, `item_states`, `costs` y `currencies` con un join de
Sequelize, sin N+1.
`GET /stocks/available/:product_id` es un alias de la misma consulta.

```bash
curl "http://localhost:3001/stocks/available?product_id=15" \
  -H "Authorization: Bearer <jwt>"
```

Respuesta `200`:

```json
[
  {
    "product_id": 15,
    "item_state_id": 1,
    "quantity": 40,
    "cost": 20.0,
    "currency_id": 3,
    "currency": {
      "id": 3,
      "code": "USD_BCV",
      "name": "Dólar BCV",
      "symbol": "$"
    },
    "item_state": {
      "id": 1,
      "name": "sellable",
      "label": "Vendible",
      "is_sellable": true
    }
  }
]
```

Errores comunes del módulo:

| Código | Cuerpo                                         |
| ------ | ---------------------------------------------- |
| `401`  | `{ "message": "Unauthorized" }`                |
| `403`  | `{ "message": "Forbidden" }`                   |
| `404`  | `{ "message": "Stock not found" }`             |
| `422`  | `{ "errors": { "product_id": "Invalid id" } }` |

### Incremento desde compras (HU-21)

El módulo expone internamente `stockRepository.applyPurchaseItems(items, {
transaction })`. Por cada `(product_id, item_state_id)` agrupa las cantidades,
crea la fila si no existe (`findOrCreate`) o incrementa la existente con
`increment` atómico bajo bloqueo de fila, siempre dentro de la transacción
recibida. Si un ítem falla, la transacción revierte todos los cambios; dos
compras concurrentes no pierden incrementos. No hay endpoint público que llame
a esta función.

## Compras (purchases)

Las compras guardan la cabecera en `purchases` y sus líneas en
`purchase_items`. El servidor asigna el `number` ascendente desde la secuencia
PostgreSQL `purchases_number_seq`, ignora cualquier `number`, `status`,
totales o `confirmed_at` enviado por el cliente y calcula siempre a partir de
las líneas:

- `subtotal = Σ(quantity × unit_cost)`
- `tax_amount = Σ(tax_amount de cada línea)`
- `total = subtotal + tax_amount`

Cada línea guarda un `tax_amount` absoluto en la moneda de la compra (no una
tasa ni una referencia al catálogo `taxes`). `unit_cost` y `subtotal` son
montos antes de impuesto; el `total` de la línea es `subtotal + tax_amount` y se
calcula al serializar. El dinero usa `DECIMAL(12,2)` y el cálculo interno se
hace en centavos para no arrastrar errores de coma flotante. `tax_rate` ya no
existe: si el cliente lo envía se ignora. Los timestamps de auditoría nunca se
exponen.

### Ciclo de vida

| Estado      | Editar | Líneas | Cancelar | Eliminar | Confirmar |
| ----------- | ------ | ------ | -------- | -------- | --------- |
| `draft`     | ✅ 202 | ✅     | ✅ 200   | ✅ 204   | ✅ 200    |
| `confirmed` | ❌ 409 | ❌ 409 | ❌ 409   | ❌ 409   | ❌ 409    |
| `cancelled` | ❌ 409 | ❌ 409 | ❌ 409   | ❌ 409   | ❌ 409    |

Confirmar es irreversible en esta historia: una compra confirmada no se edita,
cancela ni borra; las correcciones se hacen con una compra nueva. Confirmar no
es idempotente: repetir la confirmación responde `409`.

### Roles

| Endpoint                                                | admin | seller | manager_warehouse | dispatcher | support  | customer |
| ------------------------------------------------------- | ----- | ------ | ----------------- | ---------- | -------- | -------- |
| `POST /purchases` y escrituras `/purchases/...`         | ✅    | ✅     | ❌ `403`          | ❌ `403`   | ❌ `403` | ❌ `403` |
| `GET /purchases`, `GET /purchases/:id`, `GET .../items` | ✅    | ✅     | ✅                | ❌ `403`   | ❌ `403` | ❌ `403` |

### `POST /purchases`

Protegido para `admin` y `seller`. `supplier_id` es obligatorio; `currency_id`,
`notes` e `items` son opcionales. `currency_id` toma la moneda por defecto
(`USD_BCV`) cuando se omite, debe existir y estar activa si se envía, y todos
los montos de la compra y de sus líneas quedan expresados en ella. Cada línea
requiere `product_id`, `item_state_id`, `quantity`, `unit_cost` y un
`tax_amount` absoluto (`>= 0`, máximo 2 decimales y 10 dígitos enteros); si
falta el impuesto responde `422` con
`{ "errors": { "items.0.tax_amount": "tax_amount is required" } }`. Las líneas
se validan contra `products` e `item_states` y no se repite
`(product_id, item_state_id)` en una misma compra (`409`). Responde `201` con la
compra, su moneda y sus líneas.

```bash
curl -X POST http://localhost:3001/purchases \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": 1,
    "notes": "Reposición mensual",
    "items": [
      {
        "product_id": 15,
        "item_state_id": 1,
        "quantity": 40,
        "unit_cost": 20.0,
        "tax_amount": 128.0
      },
      {
        "product_id": 15,
        "item_state_id": 2,
        "quantity": 3,
        "unit_cost": 12.5,
        "tax_amount": 6.0
      }
    ]
  }'
```

Respuesta `201`:

```json
{
  "id": 1,
  "number": 1,
  "supplier_id": 1,
  "currency_id": 3,
  "currency": {
    "id": 3,
    "code": "USD_BCV",
    "name": "Dólar BCV",
    "symbol": "$"
  },
  "status": "draft",
  "subtotal": 837.5,
  "tax_amount": 134,
  "total": 971.5,
  "notes": "Reposición mensual",
  "items": [
    {
      "id": 1,
      "product_id": 15,
      "item_state_id": 1,
      "quantity": 40,
      "unit_cost": 20,
      "subtotal": 800,
      "tax_amount": 128,
      "total": 928
    },
    {
      "id": 2,
      "product_id": 15,
      "item_state_id": 2,
      "quantity": 3,
      "unit_cost": 12.5,
      "subtotal": 37.5,
      "tax_amount": 6,
      "total": 43.5
    }
  ]
}
```

Para crear la compra en otra moneda activa, envía `currency_id`; no se convierte
ningún monto:

```bash
curl -X POST http://localhost:3001/purchases \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": 1,
    "currency_id": 1,
    "items": [
      {
        "product_id": 15,
        "item_state_id": 1,
        "quantity": 40,
        "unit_cost": 20.0,
        "tax_amount": 128.0
      }
    ]
  }'
```

### `GET /purchases` y `GET /purchases/:id`

`GET /purchases` lista por `number` descendente y acepta los filtros exactos
`?supplier_id=`, `?status=draft|confirmed|cancelled`, `?number=` y
`?currency_id=`. Con
`?include=items` cada compra incluye sus líneas. `GET /purchases/:id` devuelve
siempre `items` y el `supplier` anidado, o `404` con
`{ "message": "Purchase not found" }`.

```bash
curl "http://localhost:3001/purchases?status=draft&include=items" \
  -H "Authorization: Bearer <jwt>"

curl http://localhost:3001/purchases/1 \
  -H "Authorization: Bearer <jwt>"
```

### `PUT /purchases/:id`, `DELETE /purchases/:id` y `POST /purchases/:id/cancel`

`PUT` acepta `supplier_id`, `currency_id` y/o `notes`, recalcula los totales
desde los impuestos de las líneas y responde `202`. `tax_rate` se ignora; si es
el único campo del cuerpo responde `400` con
`{ "message": "At least one field is required" }`. Cambiar `currency_id` solo se
permite en `draft` y **no convierte** los montos: `unit_cost`, `subtotal`,
`tax_amount` y `total` conservan su valor numérico. No acepta `items`. `DELETE`
solo borra borradores (`204`, con cascada a las líneas) y
`POST /purchases/:id/cancel` cambia el estado a `cancelled` (`200`) sin tocar
`costs` ni `stocks`. Cualquier intento sobre una compra confirmada o cancelada
responde `409` con `{ "message": "Purchase is not editable" }`.

```bash
curl -X PUT http://localhost:3001/purchases/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "notes": "Reposición ajustada" }'

curl -X POST http://localhost:3001/purchases/1/cancel \
  -H "Authorization: Bearer <jwt>"
```

### Líneas: `/purchases/:id/items`

- `GET /purchases/:id/items` lista las líneas de un borrador.
- `POST /purchases/:id/items` agrega una línea (`product_id`,
  `item_state_id`, `quantity`, `unit_cost` y `tax_amount`) y responde `201`.
  Sin `tax_amount` responde `400` con
  `{ "message": "product_id, item_state_id, quantity, unit_cost and tax_amount are required" }`.
- `PUT /purchases/:purchase_id/items/:item_id` actualiza cualquier combinación
  de esos cinco campos y responde `202`; si omite `tax_amount` conserva el
  valor actual.
- `DELETE /purchases/:purchase_id/items/:item_id` elimina la línea y responde
  `204`.

Las líneas **no** llevan `currency_id`: todos sus montos se expresan en la
moneda de la compra padre. Si el cliente envía `currency_id` dentro de una línea,
se ignora. Cada alta, edición o baja recalcula la cabecera; al borrar la última
línea los totales quedan en `0`. Solo se permiten sobre borradores. Si la línea no
pertenece a la compra responde `404` con `{ "message": "Item not found" }` y un
producto/estado repetido responde `409` con
`{ "message": "Item already exists" }`.

```bash
curl -X POST http://localhost:3001/purchases/1/items \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "product_id": 15, "item_state_id": 1, "quantity": 10, "unit_cost": 15.5, "tax_amount": 8.0 }'

curl -X PUT http://localhost:3001/purchases/1/items/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "quantity": 12, "unit_cost": 18.75, "tax_amount": 9.5 }'

curl -X DELETE http://localhost:3001/purchases/1/items/1 \
  -H "Authorization: Bearer <jwt>"
```

### `POST /purchases/:id/confirm`

Protegido para `admin` y `seller`. En **una sola transacción** recalcula los
totales sumando subtotales e impuestos de las líneas, hace _upsert_ en `costs`
por `(product_id, item_state_id)` usando `unit_cost` sin impuesto (la última
compra confirmada gana), incrementa `stocks.quantity` con
`stockRepository.applyPurchaseItems(items, { transaction })` y marca
`status = confirmed` con `confirmed_at`. Si cualquier paso falla se revierte
todo: ni costos ni stocks cambian. El _upsert_ de `costs` hereda
`currency_id` de la compra; si la moneda fue desactivada después de crear la
compra, la confirmación se permite porque la referencia es histórica. Sin líneas
responde `422` con `{ "message": "Purchase has no items" }`; si ya estaba
confirmada responde `409` con `{ "message": "Purchase already confirmed" }`.

```bash
curl -X POST http://localhost:3001/purchases/1/confirm \
  -H "Authorization: Bearer <jwt>"
```

### Errores del módulo

| Código | Cuerpo                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------ |
| `400`  | `{ "message": "supplier_id is required" }` / `{ "message": "At least one field is required" }`         |
| `401`  | `{ "message": "Unauthorized" }`                                                                        |
| `403`  | `{ "message": "Forbidden" }`                                                                           |
| `404`  | `{ "message": "Purchase not found" }` / `{ "message": "Item not found" }`                              |
| `409`  | `{ "message": "Purchase is not editable" }` / `"Purchase already confirmed"` / `"Item already exists"` |
| `422`  | `{ "errors": { ... } }` / `{ "message": "Purchase has no items" }`                                     |
| `422`  | `{ "errors": { "currency_id": "Invalid currency" } }`                                                  |
| `422`  | `{ "errors": { "items.0.tax_amount": "tax_amount is required" } }`                                     |
| `422`  | `{ "errors": { "tax_amount": "tax_amount must be >= 0" } }`                                            |
| `503`  | `{ "message": "Default transaction currency is not configured" }`                                      |

### Referencias activadas

Borrar un proveedor con compras responde `409` con
`{ "message": "Supplier is in use" }`. Borrar un estado de ítem usado por una
línea de compra (además de `costs` o `stocks`) responde `409` con
`{ "message": "Item state is in use" }`. Los productos usados por una línea de
compra tampoco se pueden borrar (`409 Product is in use`).

## Monedas (currencies)

Catálogo de monedas aceptadas por el sistema y registro append-only del
historial de tasas. `rate` es la cantidad de **VES que equivale a 1 unidad de
la moneda**: `USDT = 1000.29` y `USD_BCV = 889.89`. La moneda base es el
bolívar (`VES`), su tasa siempre es `1` y no se puede editar ni desactivar.

Roles:

- Lectura (`GET`): `admin`, `seller`, `manager_warehouse` y `dispatcher`.
- Escritura (`POST`, `PUT`, `DELETE`): solo `admin`.

### Semilla inicial

El seeder `seeders/<timestamp>-currencies.js` inserta `VES`, `USDT` y
`USD_BCV` si no existen. Es idempotente y **nunca sobrescribe** una tasa ya
modificada por un administrador: solo crea las monedas faltantes. Además deja
`USD_BCV` activa y marcada con `is_default_for_transactions = true`. Cada moneda
insertada por la semilla deja una fila de historial con `changed_by = null` y
`reason = "seed"`.

```bash
npm run db:seed
```

### `GET /currencies`

Lista las monedas activas, la base primero y luego por `code` ascendente. Con
`?include_inactive=true` (solo `admin`) incluye las desactivadas.

```bash
curl "http://localhost:3001/currencies" \
  -H "Authorization: Bearer <jwt>"
```

```json
[
  {
    "id": 1,
    "code": "VES",
    "name": "Bolívar",
    "symbol": "Bs",
    "rate": 1,
    "is_base": true,
    "is_active": true
  },
  {
    "id": 2,
    "code": "USDT",
    "name": "Tether",
    "symbol": "$",
    "rate": 1000.29,
    "is_base": false,
    "is_active": true,
    "is_default_for_transactions": false
  }
]
```

### `GET /currencies/:id`

Devuelve una moneda por id, incluso si está inactiva. Responde `404` cuando no
existe.

```bash
curl "http://localhost:3001/currencies/2" \
  -H "Authorization: Bearer <jwt>"
```

### `POST /currencies`

Crea una moneda (solo `admin`). Normaliza `code` a mayúsculas y siempre la
crea como **no base y activa**; `is_base` e `is_active` enviados por el cliente
se ignoran. Inserta la primera fila de historial dentro de la misma
transacción.

```bash
curl -X POST http://localhost:3001/currencies \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"code":"EUR","name":"Euro","symbol":"€","rate":970.5}'
```

Respuesta `201`:

```json
{
  "id": 4,
  "code": "EUR",
  "name": "Euro",
  "symbol": "€",
  "rate": 970.5,
  "is_base": false,
  "is_active": true,
  "is_default_for_transactions": false
}
```

Si el `code` ya existe (aunque esté inactivo o cambie solo mayúsculas) responde
`409` con `{ "message": "Currency already exists" }`.

### `PUT /currencies/:id`

Actualiza `name`, `symbol`, `rate`, `is_active` y el `reason` opcional (solo
`admin`). Responde `202`. `code` e `is_base` son inmutables y se ignoran.

```bash
curl -X PUT http://localhost:3001/currencies/2 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"rate":1005.75,"reason":"Actualización diaria BCV"}'
```

Respuesta `202`:

```json
{
  "id": 2,
  "code": "USDT",
  "name": "Tether",
  "symbol": "$",
  "rate": 1005.75,
  "is_base": false,
  "is_active": true,
  "is_default_for_transactions": false
}
```

Reglas:

- Cuando `rate` cambia, la actualización y la fila de historial se guardan en
  una sola transacción.
- Cambiar solo `name`, `symbol` o `is_active` **no** genera historial.
- Enviar la misma `rate` tampoco genera historial.
- `is_active = true` reactiva una moneda desactivada.
- La moneda base no puede cambiar `rate` (`409 Base currency rate cannot be
changed`) ni desactivarse (`409 Base currency cannot be deactivated`).
- La moneda por defecto para transacciones no puede desactivarse: `PUT` con
  `is_active: false` o `DELETE` responde `409` con
  `{ "message": "Default transaction currency cannot be deactivated" }`.
- `is_default_for_transactions` se expone en las respuestas pero **no es
  editable por API**; en esta HU queda fija en `USD_BCV`.
- `rate` debe ser mayor que `0`, con máximo 6 decimales y máximo
  `999999999999`; si no, responde `422`.

### `DELETE /currencies/:id`

Desactiva lógicamente la moneda (solo `admin`): marca `is_active = false`,
conserva el historial y responde `204` sin cuerpo. No existe borrado físico.

```bash
curl -X DELETE http://localhost:3001/currencies/4 \
  -H "Authorization: Bearer <jwt>"
```

La moneda base y la moneda por defecto para transacciones responden `409`. Una
moneda inexistente o ya inactiva responde `404`.

### `GET /currencies/:id/history`

Devuelve el historial de tasas ordenado por `changed_at` descendente. Cada fila
incluye el usuario anidado o `null` cuando el cambio vino de la semilla o el
usuario fue eliminado. El historial no se puede editar ni borrar por API.

```bash
curl "http://localhost:3001/currencies/2/history" \
  -H "Authorization: Bearer <jwt>"
```

```json
[
  {
    "id": 5,
    "currency_id": 2,
    "previous_rate": 1000.29,
    "new_rate": 1005.75,
    "changed_by": {
      "id": 1,
      "username": "admin",
      "email": "admin@farmamad.com"
    },
    "changed_at": "2026-10-29T15:30:00.000Z",
    "reason": "Actualización diaria BCV"
  },
  {
    "id": 1,
    "currency_id": 2,
    "previous_rate": null,
    "new_rate": 1000.29,
    "changed_by": null,
    "changed_at": "2026-10-29T12:00:00.000Z",
    "reason": "seed"
  }
]
```

### Errores del módulo

| Código | Cuerpo                                                                |
| ------ | --------------------------------------------------------------------- |
| `400`  | `{ "message": "code, name, symbol and rate are required" }`           |
| `400`  | `{ "message": "At least one field is required" }`                     |
| `401`  | `{ "message": "Unauthorized" }`                                       |
| `403`  | `{ "message": "Forbidden" }`                                          |
| `404`  | `{ "message": "Currency not found" }`                                 |
| `409`  | `{ "message": "Currency already exists" }`                            |
| `409`  | `{ "message": "Base currency rate cannot be changed" }`               |
| `409`  | `{ "message": "Base currency cannot be deactivated" }`                |
| `409`  | `{ "message": "Default transaction currency cannot be deactivated" }` |
| `422`  | `{ "errors": { "rate": "rate must be greater than 0" } }`             |

### Moneda por defecto para transacciones (HU-26)

`currencies.is_default_for_transactions` marca la moneda que usan los endpoints
de costos y compras cuando el cliente omite `currency_id`. La columna es
`BOOLEAN NOT NULL DEFAULT false`, tiene un índice único parcial
`currencies_default_transaction_unique ON currencies (is_default_for_transactions)
WHERE is_default_for_transactions = true` y la migración de HU-26 deja
`USD_BCV` (`rate = 889.89`) como única moneda por defecto activa.

- `GET /currencies` y `GET /currencies/:id` incluyen el flag.
- `POST /costs` y `POST /purchases` usan `USD_BCV` si no se envía `currency_id`.
- `GET /costs?currency_id=` y `GET /purchases?currency_id=` filtran por moneda.
- Las respuestas de costos, compras y stock disponible anidan `currency`
  (`id`, `code`, `name`, `symbol`).
- No existe conversión de montos: la moneda solo etiqueta el valor.
- Si no hay una moneda por defecto activa, los endpoints que la necesitan
  responden `503` con
  `{ "message": "Default transaction currency is not configured" }`.

## Estantes y secciones (shelves, shelf_sections)

Jerarquía física del inventario:

```text
warehouse (HU-11)
  └── shelf
        └── shelf_section
```

Cada estante pertenece a **una** bodega y cada sección a **un** estante. Las
tablas son `shelves` (modelo `Shelf`) y `shelf_sections` (modelo
`ShelfSection`). `code` es obligatorio, se guarda en **mayúsculas**, acepta
`[A-Za-z0-9_-]{1,50}` y es único dentro de su padre ignorando mayúsculas. `name`
(máximo 100) y `description` (máximo 255) son opcionales. Ninguna respuesta
incluye `createdAt` ni `updatedAt`.

Reglas de integridad:

- `warehouse_id` es inmutable: no se puede mover un estante de bodega por
  `PUT` (`422`).
- `shelf_id` es inmutable: no se puede mover una sección de estante por `PUT`
  (`422`).
- Borrar una bodega con estantes está bloqueado por la FK `RESTRICT`.
- Borrar un estante elimina sus secciones en cascada.
- Si HU-24 (`lots`) ya está instalada y un lote referencia el estante o una de
  sus secciones, el borrado responde `409` y no elimina nada. La comprobación es
  defensiva: mientras la tabla `lots` no exista, el borrado funciona con
  normalidad y la FK se sigue traduciendo a `409` cuando aparezca.

Roles:

- Lectura (`GET`): `admin`, `seller`, `manager_warehouse` y `dispatcher`.
- Escritura (`POST`, `PUT`, `DELETE`): `admin` y `manager_warehouse`.

| Endpoint                                         | `admin` | `seller` | `dispatcher` | `manager_warehouse` | `support` | `customer` |
| ------------------------------------------------ | ------- | -------- | ------------ | ------------------- | --------- | ---------- |
| `POST /shelves`                                  | ✅      | ❌ `403` | ❌ `403`     | ✅                  | ❌ `403`  | ❌ `403`   |
| `GET /shelves`                                   | ✅      | ✅       | ✅           | ✅                  | ❌ `403`  | ❌ `403`   |
| `GET /shelves/:id`                               | ✅      | ✅       | ✅           | ✅                  | ❌ `403`  | ❌ `403`   |
| `PUT /shelves/:id`                               | ✅      | ❌ `403` | ❌ `403`     | ✅                  | ❌ `403`  | ❌ `403`   |
| `DELETE /shelves/:id`                            | ✅      | ❌ `403` | ❌ `403`     | ✅                  | ❌ `403`  | ❌ `403`   |
| `POST /shelves/:shelf_id/sections`               | ✅      | ❌ `403` | ❌ `403`     | ✅                  | ❌ `403`  | ❌ `403`   |
| `GET /shelves/:shelf_id/sections`                | ✅      | ✅       | ✅           | ✅                  | ❌ `403`  | ❌ `403`   |
| `GET /shelves/:shelf_id/sections/:section_id`    | ✅      | ✅       | ✅           | ✅                  | ❌ `403`  | ❌ `403`   |
| `PUT /shelves/:shelf_id/sections/:section_id`    | ✅      | ❌ `403` | ❌ `403`     | ✅                  | ❌ `403`  | ❌ `403`   |
| `DELETE /shelves/:shelf_id/sections/:section_id` | ✅      | ❌ `403` | ❌ `403`     | ✅                  | ❌ `403`  | ❌ `403`   |

Un usuario bloqueado recibe `403` con `{ "message": "User is blocked" }` y sin
token (o con token inválido/expirado) la respuesta es `401` con
`{ "message": "Unauthorized" }`.

### `POST /shelves`

Requiere `warehouse_id` y `code`; `name` y `description` son opcionales. El
`code` se recorta y se guarda en mayúsculas. La bodega debe existir.

```bash
curl -X POST http://localhost:3001/shelves \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"warehouse_id":1,"code":"A1","name":"Estante A1","description":"Pasillo principal"}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "warehouse_id": 1,
  "code": "A1",
  "name": "Estante A1",
  "description": "Pasillo principal",
  "sections": []
}
```

Errores:

| Código | Cuerpo                                                              |
| ------ | ------------------------------------------------------------------- |
| `400`  | `{ "message": "warehouse_id and code are required" }`               |
| `401`  | `{ "message": "Unauthorized" }`                                     |
| `403`  | `{ "message": "Forbidden" }`                                        |
| `409`  | `{ "message": "Shelf already exists" }`                             |
| `422`  | `{ "errors": { "warehouse_id": "Invalid warehouse id" } }`          |
| `422`  | `{ "errors": { "code": "code must match ^[A-Za-z0-9_-]{1,50}$" } }` |

### `GET /shelves`

Lista los estantes ordenados por `warehouse_id` y luego por `code`, ambos
ascendentes. Filtro opcional exacto `warehouse_id` (entero positivo). Con
`include=sections` cada estante incluye su arreglo `sections` ordenado por
`code`; la consulta se resuelve con un `include` de Sequelize, sin N+1.

```bash
curl "http://localhost:3001/shelves?warehouse_id=1&include=sections" \
  -H "Authorization: Bearer <jwt>"
```

```json
[
  {
    "id": 1,
    "warehouse_id": 1,
    "code": "A1",
    "name": "Estante A1",
    "description": "Pasillo principal",
    "sections": [
      {
        "id": 1,
        "shelf_id": 1,
        "code": "A1-01",
        "name": "Nivel 1",
        "description": null
      },
      {
        "id": 2,
        "shelf_id": 1,
        "code": "A1-02",
        "name": "Nivel 2",
        "description": null
      }
    ]
  }
]
```

Sin `include=sections` los objetos no llevan la clave `sections`. Un
`warehouse_id` inválido o un `include` distinto de `sections` responde `422`.

### `GET /shelves/:id`

Devuelve el estante con sus secciones ordenadas por `code`. Un id inválido
responde `422` y un estante inexistente `404`.

```bash
curl http://localhost:3001/shelves/1 -H "Authorization: Bearer <jwt>"
```

### `PUT /shelves/:id`

Actualiza `code`, `name` y `description`; responde `202` con el estante
actualizado y sus secciones. Debe enviarse al menos un campo editable.
`warehouse_id` es inmutable y responde `422` si se envía.

```bash
curl -X PUT http://localhost:3001/shelves/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"code":"A1","name":"Estante A1 actualizado","description":"Pasillo principal, lado izquierdo"}'
```

Errores:

| Código | Cuerpo                                                               |
| ------ | -------------------------------------------------------------------- |
| `400`  | `{ "message": "At least one field is required" }`                    |
| `404`  | `{ "message": "Shelf not found" }`                                   |
| `409`  | `{ "message": "Shelf already exists" }`                              |
| `422`  | `{ "errors": { "warehouse_id": "warehouse_id cannot be changed" } }` |
| `422`  | `{ "errors": { "id": "Invalid shelf id" } }`                         |

### `DELETE /shelves/:id`

Elimina el estante y sus secciones en cascada. Responde `204` sin cuerpo. Si un
lote de HU-24 referencia el estante o alguna de sus secciones, responde `409`
con `{ "message": "Shelf has lots" }` y no elimina nada.

```bash
curl -X DELETE http://localhost:3001/shelves/1 \
  -H "Authorization: Bearer <jwt>"
```

### `POST /shelves/:shelf_id/sections`

Crea una sección dentro del estante. Requiere `code`; `name` y `description`
son opcionales. Si el estante no existe responde `404`.

```bash
curl -X POST http://localhost:3001/shelves/1/sections \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"code":"A1-03","name":"Nivel 3"}'
```

Respuesta `201`:

```json
{
  "id": 3,
  "shelf_id": 1,
  "code": "A1-03",
  "name": "Nivel 3",
  "description": null
}
```

Errores: `400` si falta `code`, `404 Shelf not found`, `409 Section already
exists` y `422` para `shelf_id` o campos inválidos.

### `GET /shelves/:shelf_id/sections`

Lista las secciones del estante ordenadas por `code` ascendente. Un estante
inexistente responde `404`; un `shelf_id` inválido responde `422`.

```bash
curl http://localhost:3001/shelves/1/sections \
  -H "Authorization: Bearer <jwt>"
```

### `GET /shelves/:shelf_id/sections/:section_id`

Devuelve una sección. La búsqueda está acotada al estante de la URL: una sección
de otro estante responde `404 Section not found` (no se puede operar cambiando
el `shelf_id`).

```bash
curl http://localhost:3001/shelves/1/sections/3 \
  -H "Authorization: Bearer <jwt>"
```

### `PUT /shelves/:shelf_id/sections/:section_id`

Actualiza `code`, `name` y `description`; responde `202`. Exige al menos un
campo editable y rechaza `shelf_id` con `422 shelf_id cannot be changed`.

```bash
curl -X PUT http://localhost:3001/shelves/1/sections/3 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"code":"A1-03","name":"Nivel 3 actualizado"}'
```

### `DELETE /shelves/:shelf_id/sections/:section_id`

Elimina la sección y responde `204` sin cuerpo. Si un lote la referencia,
responde `409` con `{ "message": "Section has lots" }` y no elimina nada.

```bash
curl -X DELETE http://localhost:3001/shelves/1/sections/3 \
  -H "Authorization: Bearer <jwt>"
```

### Errores del módulo

| Código | Cuerpo                                                               |
| ------ | -------------------------------------------------------------------- |
| `400`  | `{ "message": "warehouse_id and code are required" }`                |
| `400`  | `{ "message": "code is required" }`                                  |
| `400`  | `{ "message": "At least one field is required" }`                    |
| `401`  | `{ "message": "Unauthorized" }`                                      |
| `403`  | `{ "message": "Forbidden" }`                                         |
| `404`  | `{ "message": "Shelf not found" }`                                   |
| `404`  | `{ "message": "Section not found" }`                                 |
| `409`  | `{ "message": "Shelf already exists" }`                              |
| `409`  | `{ "message": "Section already exists" }`                            |
| `409`  | `{ "message": "Shelf has lots" }`                                    |
| `409`  | `{ "message": "Section has lots" }`                                  |
| `422`  | `{ "errors": { "warehouse_id": "Invalid warehouse id" } }`           |
| `422`  | `{ "errors": { "shelf_id": "Invalid shelf id" } }`                   |
| `422`  | `{ "errors": { "section_id": "Invalid section id" } }`               |
| `422`  | `{ "errors": { "warehouse_id": "warehouse_id cannot be changed" } }` |
| `422`  | `{ "errors": { "shelf_id": "shelf_id cannot be changed" } }`         |

## Lotes (lots)

Cada lote representa las unidades físicas de un producto con su número, fecha
de expiración, estado de ítem, cantidades y ubicación. La tabla es `lots`
(modelo `Lot`) y referencia de forma restrictiva a `products`, `item_states`,
`warehouses`, `shelves` y `shelf_sections`.

Reglas de negocio:

- `number` es obligatorio, se recorta, tiene 1–100 caracteres y es único por
  producto **ignorando mayúsculas/minúsculas** mediante el índice funcional
  `(product_id, LOWER(number))`.
- `expiration_date` es una fecha `YYYY-MM-DD` obligatoria; se acepta una fecha
  ya vencida porque el lote sigue existiendo en inventario.
- `stock` y `reserved` son enteros entre `0` y `1 000 000 000`, con `0` por
  defecto al crear. La base de datos impone `stock >= 0`, `reserved >= 0` y
  `reserved <= stock`.
- `available = stock - reserved` se calcula al serializar y nunca se almacena.
- El estante debe pertenecer a la bodega y la sección al estante; si no, la API
  responde `422`. Estas comprobaciones y la escritura ocurren en una
  transacción.
- Las respuestas nunca incluyen `createdAt` ni `updatedAt`.
- `lots` no sincroniza automáticamente el agregado `stocks` de HU-20.

Roles:

- Lectura (`GET`): `admin`, `seller`, `manager_warehouse` y `dispatcher`.
- Escritura (`POST`, `PUT`, `DELETE`): `admin`, `seller` y
  `manager_warehouse`.

| Endpoint           | `admin` | `seller` | `dispatcher` | `manager_warehouse` | `support` | `customer` |
| ------------------ | ------- | -------- | ------------ | ------------------- | --------- | ---------- |
| `GET /lots`        | ✅      | ✅       | ✅           | ✅                  | ❌ `403`  | ❌ `403`   |
| `GET /lots/:id`    | ✅      | ✅       | ✅           | ✅                  | ❌ `403`  | ❌ `403`   |
| `POST /lots`       | ✅      | ✅       | ❌ `403`     | ✅                  | ❌ `403`  | ❌ `403`   |
| `PUT /lots/:id`    | ✅      | ✅       | ❌ `403`     | ✅                  | ❌ `403`  | ❌ `403`   |
| `DELETE /lots/:id` | ✅      | ✅       | ❌ `403`     | ✅                  | ❌ `403`  | ❌ `403`   |

### `POST /lots`

Requiere `number`, `product_id`, `expiration_date`, `item_state_id`,
`warehouse_id`, `shelf_id` y `section_id`; `stock` y `reserved` son opcionales
y valen `0` por defecto. Todas las referencias deben existir y la ubicación debe
ser coherente.

```bash
curl -X POST http://localhost:3001/lots \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"number":"L-2026-001","product_id":15,"expiration_date":"2027-03-31","item_state_id":1,"stock":120,"reserved":15,"warehouse_id":1,"shelf_id":1,"section_id":2}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "number": "L-2026-001",
  "product_id": 15,
  "expiration_date": "2027-03-31",
  "item_state_id": 1,
  "stock": 120,
  "reserved": 15,
  "available": 105,
  "warehouse_id": 1,
  "shelf_id": 1,
  "section_id": 2,
  "product": { "id": 15, "name": "Ibuprofeno 800 mg", "reference": "IBU-800" },
  "item_state": {
    "id": 1,
    "name": "sellable",
    "label": "Vendible",
    "is_sellable": true
  },
  "warehouse": { "id": 1, "name": "Bodega Central" },
  "shelf": { "id": 1, "code": "A1", "name": "Estante A1" },
  "section": { "id": 2, "code": "A1-02", "name": "Nivel 2" }
}
```

### `GET /lots`

Lista los lotes ordenados por `expiration_date` ascendente y luego por `id`.
Incluye los anidados `product`, `item_state`, `warehouse`, `shelf` y `section`
en una sola consulta con `include` de Sequelize (sin N+1).

Filtros opcionales:

| Filtro            | Significado                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `product_id`      | Producto exacto.                                                 |
| `item_state_id`   | Estado de ítem exacto.                                           |
| `warehouse_id`    | Bodega exacta.                                                   |
| `shelf_id`        | Estante exacto.                                                  |
| `section_id`      | Sección exacta.                                                  |
| `number`          | Número de lote exacto, sin distinguir mayúsculas/minúsculas.     |
| `expired`         | `true` para `expiration_date < CURRENT_DATE`; `false` para `>=`. |
| `expiring_before` | Fecha máxima inclusive `YYYY-MM-DD`.                             |

```bash
curl "http://localhost:3001/lots?product_id=15&warehouse_id=1&expired=false&expiring_before=2027-12-31" \
  -H "Authorization: Bearer <jwt>"
```

```json
[
  {
    "id": 1,
    "number": "L-2026-001",
    "product_id": 15,
    "expiration_date": "2027-03-31",
    "item_state_id": 1,
    "stock": 120,
    "reserved": 15,
    "available": 105,
    "warehouse_id": 1,
    "shelf_id": 1,
    "section_id": 2,
    "product": {
      "id": 15,
      "name": "Ibuprofeno 800 mg",
      "reference": "IBU-800"
    },
    "item_state": {
      "id": 1,
      "name": "sellable",
      "label": "Vendible",
      "is_sellable": true
    },
    "warehouse": { "id": 1, "name": "Bodega Central" },
    "shelf": { "id": 1, "code": "A1", "name": "Estante A1" },
    "section": { "id": 2, "code": "A1-02", "name": "Nivel 2" }
  }
]
```

### `GET /lots/:id`

Devuelve el detalle con los anidados y `available`. Un id inválido responde
`422` y un lote inexistente `404 Lot not found`.

```bash
curl http://localhost:3001/lots/1 -H "Authorization: Bearer <jwt>"
```

### `PUT /lots/:id`

Reemplaza todos los campos editables y responde `202` con el lote actualizado.
Exige `number`, `product_id`, `expiration_date`, `item_state_id`, `stock`,
`reserved`, `warehouse_id`, `shelf_id` y `section_id`. Vuelve a validar las
referencias y la coherencia de ubicación, y rechaza `reserved > stock` con
`422`. Los campos `id`, `available`, `createdAt` y `updatedAt` se ignoran.

```bash
curl -X PUT http://localhost:3001/lots/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"number":"L-2026-001","product_id":15,"expiration_date":"2027-03-31","item_state_id":1,"stock":100,"reserved":10,"warehouse_id":1,"shelf_id":1,"section_id":2}'
```

Respuesta `202` con `"available": 90`.

### `DELETE /lots/:id`

Elimina un lote y responde `204` sin cuerpo. Solo se permite cuando
`stock = 0` y `reserved = 0`; en caso contrario responde `409 Lot has stock or
reservations` y no borra nada.

```bash
curl -X DELETE http://localhost:3001/lots/1 \
  -H "Authorization: Bearer <jwt>"
```

### Errores del módulo

| Código | Cuerpo                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `{ "message": "number, product_id, expiration_date, item_state_id, warehouse_id, shelf_id and section_id are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                                                                                           |
| `403`  | `{ "message": "Forbidden" }`                                                                                              |
| `404`  | `{ "message": "Lot not found" }`                                                                                          |
| `409`  | `{ "message": "Lot already exists" }`                                                                                     |
| `409`  | `{ "message": "Lot has stock or reservations" }`                                                                          |
| `422`  | `{ "errors": { "reserved": "reserved cannot exceed stock" } }`                                                            |
| `422`  | `{ "errors": { "shelf_id": "Shelf does not belong to the warehouse" } }`                                                  |
| `422`  | `{ "errors": { "section_id": "Section does not belong to the shelf" } }`                                                  |
| `422`  | `{ "errors": { "expiration_date": "expiration_date must be a valid date (YYYY-MM-DD)" } }`                                |

## Términos de pago (`payment_terms`) — HU-41

Catálogo de condiciones de pago reutilizado por clientes, pedidos y facturas.
Cada fila de la tabla `payment_terms` (modelo `PaymentTerm`) tiene un `code`
único ignorando mayúsculas, un `name`, una `description` opcional, `days` y
`is_active`. `days = 0` significa **contado** y `days > 0` significa **crédito**;
el máximo es `3650`.

El seeder `seeders/20260910000007-payment-terms.js` crea de forma idempotente:

| `code`      | `name`             | `days` |
| ----------- | ------------------ | ------ |
| `cash`      | Contado            | 0      |
| `credit_10` | Crédito 10 días    | 10     |
| `credit_15` | Crédito 15 días    | 15     |

Reglas de negocio:

- `code` se normaliza a minúsculas, cumple `^[a-z][a-z0-9_]{1,29}$` y es único
  ignorando mayúsculas mediante un índice funcional sobre `LOWER(code)`. Es
  inmutable: un `PUT` que lo envíe lo ignora.
- `name` mide entre 1 y 100 caracteres; `description` admite hasta 255 y se
  guarda como `null` cuando se omite o llega vacía.
- `days` debe ser un entero entre 0 y 3650; no se aceptan decimales, negativos
  ni valores no numéricos.
- `is_active` es booleano y vale `true` por defecto. Un término inactivo no se
  puede asignar a clientes, pedidos ni facturas nuevas, pero las referencias
  existentes se conservan.
- `DELETE` es físico. Si el término está asignado a un cliente, pedido o
  factura responde `409` con `{ "message": "Payment term is in use" }`; las FK
  `ON DELETE RESTRICT` protegen la integridad incluso ante peticiones
  simultáneas.
- Los timestamps `createdAt` y `updatedAt` nunca se exponen.

Permisos por endpoint:

| Endpoint                    | `admin` | `seller` | Otros roles |
| --------------------------- | ------- | -------- | ----------- |
| `POST /payment-terms`       | ✅      | ✅       | ❌ `403`    |
| `GET /payment-terms`        | ✅      | ✅       | ❌ `403`    |
| `GET /payment-terms/:id`    | ✅      | ✅       | ❌ `403`    |
| `PUT /payment-terms/:id`    | ✅      | ✅       | ❌ `403`    |
| `DELETE /payment-terms/:id` | ✅      | ✅       | ❌ `403`    |

### `POST /payment-terms`

Requiere `code`, `name` y `days`. `description` e `is_active` son opcionales.

```bash
curl -X POST http://localhost:3001/payment-terms \
  -H "Authorization: Bearer <jwt-admin>" \
  -H "Content-Type: application/json" \
  -d '{"code":"credit_30","name":"Crédito 30 días","description":"Pago a 30 días","days":30,"is_active":true}'
```

Respuesta `201`:

```json
{
  "id": 4,
  "code": "credit_30",
  "name": "Crédito 30 días",
  "description": "Pago a 30 días",
  "days": 30,
  "is_active": true
}
```

### `GET /payment-terms`

Lista los términos ordenados por `days` ascendente y luego `id` ascendente.
Filtro exacto opcional: `?is_active=true|false`.

```bash
curl "http://localhost:3001/payment-terms?is_active=true" \
  -H "Authorization: Bearer <jwt>"
```

### `GET /payment-terms/:id`

Devuelve un término. Un id inválido responde `422` con
`{ "errors": { "id": "Invalid payment term id" } }` y uno inexistente `404`
con `{ "message": "Payment term not found" }`.

### `PUT /payment-terms/:id`

Reemplaza `name`, `description`, `days` e `is_active` y responde `202`. El
`code` es inmutable. Un cuerpo sin campos editables responde `400` con
`{ "message": "At least one field is required" }`.

```bash
curl -X PUT http://localhost:3001/payment-terms/4 \
  -H "Authorization: Bearer <jwt-admin>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Crédito 45 días","days":45,"is_active":true}'
```

### `DELETE /payment-terms/:id`

Elimina un término no usado y responde `204` sin cuerpo. Si está asignado a un
cliente, pedido o factura responde `409`.

### Asignación a clientes

`POST /customers` y `PUT /customers/:id` aceptan `payment_term_id` opcional. En
`PUT`, omitirlo conserva el término actual, `null` lo limpia y un entero lo
reemplaza cuando existe y está activo. Las respuestas de clientes incluyen
`payment_term_id` y `payment_term` (`{ id, code, name, days }`) o `null`.

```bash
curl -X PUT http://localhost:3001/customers/8 \
  -H "Authorization: Bearer <jwt-admin>" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Cliente Demo","latitude":-17.7833,"longitude":-63.1821,"direction":"Av. Monseñor Rivero 123","email":"cliente@example.com","payment_term_id":2}'
```

### Pedidos y facturas

- `POST /orders` copia `customers.payment_term_id`; un `customer` no puede
  enviar otro término. `admin`/`seller` pueden enviarlo o copiar el del cliente
  al crear un pedido en `draft`.
- `PUT /orders/:id/payment-term` reemplaza el término de un pedido en `draft` o
  `request`; en `generate`, `invoiced`, `cancelled` o cualquier otro estado
  responde `422` con `{ "errors": { "status": "Order is not editable" } }`.
- Las transiciones `draft → request`, `draft → generate` y `request →
  generate` exigen un término activo (ver la sección de HU-39).
- Al emitir la factura se copia `orders.payment_term_id`, se exige un término
  activo y `due_date` se calcula como `issued_at + payment_terms.days`; para
  contado (`days = 0`) es la misma fecha de emisión. Cambiar o desactivar el
  término después no altera facturas existentes.

### Errores del módulo

| Código | Situación                                      | Cuerpo                                                        |
| ------ | ---------------------------------------------- | ------------------------------------------------------------- |
| `400`  | Faltan `code`, `name` o `days`                 | `{ "message": "code, name and days are required" }`           |
| `401`  | Token ausente, inválido o expirado             | `{ "message": "Unauthorized" }`                               |
| `403`  | Rol sin permiso o usuario bloqueado            | `{ "message": "Forbidden" }`                                  |
| `404`  | Término inexistente                            | `{ "message": "Payment term not found" }`                     |
| `409`  | Código duplicado                               | `{ "message": "Payment term already exists" }`                |
| `409`  | Término en uso                                 | `{ "message": "Payment term is in use" }`                     |
| `422`  | Días, id o término inválido/inactivo           | `{ "errors": { "days": "..." } }` o `payment_term_id`         |
| `500`  | Error interno                                  | `{ "message": "Internal server error" }`                      |

## Estados y ciclo de vida de pedidos — HU-39

El ciclo de vida de un pedido es una cadena configurable de estados:
`draft → request → generate → invoiced`, con `cancelled` disponible desde
cualquier estado no terminal. Los seis estados anteriores (`pending`,
`confirmed`, `preparing`, `shipped`, `delivered`, `cancelled`) dejan de ser la
fuente de verdad; la migración los mapea a los nuevos códigos.

### Catálogo `order_statuses`

| `code`      | `name`       | `sort_order` | `next_status_code` | `is_system` |
| ----------- | ------------ | ------------ | ------------------ | ----------- |
| `draft`     | Borrador     | 10           | `request`          | `true`      |
| `request`   | Solicitado   | 20           | `generate`         | `true`      |
| `generate`  | Generado     | 30           | `invoiced`         | `true`      |
| `invoiced`  | Facturado    | 40           | `null`             | `true`      |
| `cancelled` | Cancelado    | 50           | `null`             | `true`      |

- `code` cumple `^[a-z][a-z0-9_]{1,19}$`, es único e inmutable.
- `sort_order` solo ordena el listado; no define transiciones.
- `is_terminal` se calcula como `next_status_code === null` y se expone en las
  respuestas; no es una columna.
- `next_status_code` no puede apuntar al mismo estado ni crear ciclos.
- Si falta alguno de los cinco estados base, las operaciones que dependen de
  ellos responden `503` con
  `{ "message": "Order status configuration is incomplete" }`.

La tabla `orders.status`, `order_history.from_status` y
`order_history.to_status` referencian `order_statuses.code`. La migración es
reversible y mapea los pedidos e historial anteriores:
`pending → request`, `confirmed|preparing|shipped → generate`,
`delivered → invoiced` y `cancelled → cancelled`.

### CRUD `/order-statuses`

Lectura: cualquier `customer`, `admin` o `seller` autenticado. Escritura:
solo `admin`. El resto de roles recibe `403`.

```bash
curl http://localhost:3001/order-statuses \
  -H "Authorization: Bearer <jwt-admin>"
```

```json
[
  {
    "id": 1,
    "code": "draft",
    "name": "Borrador",
    "description": null,
    "sort_order": 10,
    "next_status_code": "request",
    "is_terminal": false,
    "is_system": true
  }
]
```

Crear un estado adicional (`is_system` siempre `false`):

```bash
curl -X POST http://localhost:3001/order-statuses \
  -H "Authorization: Bearer <jwt-admin>" \
  -H "Content-Type: application/json" \
  -d '{"code":"on_hold","name":"En espera","description":"Esperando confirmación","sort_order":25,"next_status_code":"generate"}'
```

Para intercalarlo entre `request` y `generate`, después se actualiza el estado
anterior con `PUT /order-statuses/<id de request>` y
`{"next_status_code":"on_hold"}`.

- `GET /order-statuses`: ordena por `sort_order` e `id` ascendente.
- `GET /order-statuses/:id`: `422` con id inválido y `404` si no existe.
- `POST /order-statuses`: requiere `code`, `name` y `sort_order`.
- `PUT /order-statuses/:id`: actualiza `name`, `description`, `sort_order` y
  `next_status_code`; `code` e `is_system` son inmutables.
- `DELETE /order-statuses/:id`: responde `204`; los estados base responden
  `409 { "message": "System order status cannot be deleted" }` y un estado
  referenciado por pedidos, historial o como destino responde `409
  { "message": "Order status is in use" }`.
- Destino inexistente, igual al actual o que cierre un ciclo responde `422`
  con `{ "errors": { "next_status_code": "..." } }`.

### Tablas de pedidos

- `orders`: cabecera con `number` asignado por `orders_number_seq`,
  `customer_id`, `user_id`, `currency_id`, `status` (código de
  `order_statuses`), `payment_term_id`, `subtotal`, `total`,
  `delivery_address` y `notes`. `total = subtotal` porque no hay impuestos,
  descuentos ni envío.
- `order_items`: líneas con `product_id`, `item_state_id`, `quantity`,
  `unit_price` y `subtotal`. La combinación
  `(order_id, product_id, item_state_id)` es única, por lo que el mismo
  producto puede tener dos líneas con estados distintos.
- `order_item_lot_allocations`: reserva interna por lote
  (`reserved`, `released`, `consumed`). Nunca se expone en la API.
- `order_history`: eventos append-only `created`, `item_added`,
  `item_updated`, `item_removed`, `status_changed` e `invoice_issued`.
- `orders_number_seq`: numeración ascendente desde 1. Los huecos por
  transacciones fallidas son aceptables; el cliente nunca envía `number`.

### Precio y reserva

- Precio: `unit_price = round2(costo ÷ (1 − percentage / 100) × rate_costo ÷
  rate_pedido)`, con la lista del cliente y el `item_state_id` de la línea. No
  se usa `products.sale_price`.
- Moneda del pedido: moneda activa con `is_default_for_transactions = true`;
  si no existe, `503 Default transaction currency is not configured`.
- En `draft` los precios se recalculan al agregar, editar o quitar líneas, pero
  **no** se reserva stock.
- `draft → request` recalcula y congela los precios; tampoco reserva lotes ni
  modifica `lots.stock` o `stocks.quantity`.
- `draft → generate` (admin/seller) y `request → generate` reservan los lotes
  FEFO (`expiration_date`, `id`) con `FOR UPDATE`, incrementan `lots.reserved` y
  crean asignaciones `reserved`. La disponibilidad de una línea es
  `SUM(lots.stock - lots.reserved)`.
- `generate → invoiced` consume la reserva: bajan `lots.reserved`, `lots.stock`
  y `stocks.quantity`, las asignaciones pasan a `consumed` y se crea la
  factura con el servicio de HU-40.
- Cancelar libera las asignaciones `reserved` (pasan a `released`) y baja
  `lots.reserved`, sin tocar `lots.stock` ni `stocks.quantity`.
- La generación de contado (`payment_terms.days = 0`) exige saldo de billetera
  suficiente convertido a la moneda del pedido; si no, responde `409
  { "message": "Insufficient wallet balance" }`. Los pedidos a crédito no
  validan saldo.
- Toda transición y reserva es atómica. Dos generaciones simultáneas por la
  última unidad: una responde `202` y la otra `409 Insufficient stock`.

### Crear un borrador — `POST /orders`

Roles: `customer`, `admin` y `seller`.

- Un `customer` usa el cliente vinculado en `users.customer_id`, no puede
  enviar `customer_id` y necesita `customers.price_list_id`.
- `admin` puede operar con cualquier cliente y debe enviar `customer_id`;
  `seller` solo con un cliente asignado en `customer_sellers`, si no recibe
  `403 { "message": "Customer is not assigned to this seller" }`.
- Cliente inexistente: `404`. Cliente sin lista de precios: `403 Customer price
  list is not assigned`.
- `items` es opcional (0 a 50 líneas); `delivery_address` es opcional (máximo
  500 caracteres) y cae en `customers.direction`; `notes` admite hasta 1000.
- `payment_term_id` es opcional: el `customer` copia el de su perfil; el
  `admin`/`seller` puede enviarlo o copiar el del cliente; puede quedar `null`.
- El pedido nace en `draft`, con `subtotal = 0` y `total = 0` si no hay líneas.

```bash
curl -X POST http://localhost:3001/orders \
  -H "Authorization: Bearer <jwt-customer>" \
  -H "Content-Type: application/json" \
  -d '{"delivery_address":"Av. Monseñor Rivero 123","notes":"Entregar por la tarde"}'
```

Venta asistida:

```bash
curl -X POST http://localhost:3001/orders \
  -H "Authorization: Bearer <jwt-seller>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":8,"items":[{"product_id":15,"item_state_id":1,"quantity":2}]}'
```

Respuesta `201` con `status: "draft"`, `items`, `history` y los snapshots de
moneda y término de pago.

### Editar el borrador

| Endpoint                            | Acceso                                         | Respuesta |
| ----------------------------------- | ---------------------------------------------- | --------- |
| `PUT /orders/:id`                   | Dueño, admin o seller asignado, solo `draft`   | `202`     |
| `POST /orders/:id/items`            | Dueño, admin o seller asignado, solo `draft`   | `201`     |
| `PUT /orders/:id/items/:item_id`    | Solo cambia `quantity`                         | `202`     |
| `DELETE /orders/:id/items/:item_id` | Elimina la línea                               | `204`     |
| `PUT /orders/:id/payment-term`      | Admin o seller asignado, en `draft`/`request`   | `202`     |

```bash
curl -X POST http://localhost:3001/orders/10/items \
  -H "Authorization: Bearer <jwt-customer>" \
  -H "Content-Type: application/json" \
  -d '{"product_id":15,"item_state_id":1,"quantity":2}'
```

Errores del borrador:

- `item_state_id` inexistente o no vendible:
  `422 { "errors": { "item_state_id": "Invalid item state" } }`.
- Par `(product_id, item_state_id)` duplicado:
  `409 { "message": "Product and item state already in order" }`.
- Sin precio para la lista y estado:
  `422 { "errors": { "product_id": "Product has no price for this item state
  and price list" } }`.
- Pedido que no está en `draft`:
  `422 { "errors": { "status": "Order is not editable" } }`.
- Pedido ajeno o de un cliente no asignado: `404 Order not found`.
- Más de 50 líneas: `422`; `quantity` entre 1 y 999.

Cada alta, edición o borrado agrega `item_added`, `item_updated` o
`item_removed` con `metadata: { order_item_id, product_id, item_state_id,
quantity }`.

### Transiciones — `PUT /orders/:id/status`

Cuerpo: `{ "status": "<code>" }`. Responde `202` con el pedido actualizado.

| Estado actual | Destinos                                                        |
| ------------- | --------------------------------------------------------------- |
| `draft`       | `request` (solo cliente dueño), `generate` (admin/seller), `cancelled` |
| `request`     | `generate` (admin/seller), `cancelled`                          |
| `generate`    | `invoiced` (admin/seller), `cancelled`                          |
| `invoiced`    | ninguno                                                         |
| `cancelled`   | ninguno                                                         |

- Enviar el mismo estado o un salto fuera de la cadena responde `422`.
- Un cliente que intenta `generate`, `invoiced` o cualquier acción interna
  recibe `403`; `request` desde un estado distinto de `draft` responde `422`.
- `draft → request` exige al menos una línea, moneda por defecto activa, lista
  de precios y término activo. Sin término:
  `422 { "errors": { "payment_term_id": "Payment term is required" } }`; con
  término inactivo: `422 Invalid payment term`.
- `draft → generate` y `request → generate` exigen término activo, validan la
  billetera en contado y reservan lotes FEFO. Sin existencia:
  `409 { "message": "Insufficient stock", "items": [{ "product_id": 15,
  "item_state_id": 1 }] }` y el pedido conserva su estado anterior.
- `generate → invoiced` crea la factura, consume la reserva y agrega
  `status_changed` + `invoice_issued` con
  `metadata: { invoice_id, invoice_number }`.
- `invoiced` no se cancela: `422`.

```bash
curl -X PUT http://localhost:3001/orders/10/status \
  -H "Authorization: Bearer <jwt-customer>" \
  -H "Content-Type: application/json" \
  -d '{"status":"request"}'
```

```bash
curl -X PUT http://localhost:3001/orders/10/status \
  -H "Authorization: Bearer <jwt-seller>" \
  -H "Content-Type: application/json" \
  -d '{"status":"generate"}'
```

```bash
curl -X PUT http://localhost:3001/orders/10/status \
  -H "Authorization: Bearer <jwt-admin>" \
  -H "Content-Type: application/json" \
  -d '{"status":"invoiced"}'
```

### Consultas

- `GET /orders`: un `customer` solo ve sus pedidos; `admin` y `seller` ven
  todos. Cada fila agrega `items_count`. Incluye el resumen de cabecera,
  `currency`, `customer` y `payment_term`.
- `GET /orders/:id`: dueño, admin o seller. Un cliente no recibe `actor` en el
  historial; admin y seller reciben `actor: { id, username, email }` o `null`.
  Un pedido ajeno responde `404`.
- `GET /orders/:id/invoice`: dueño, admin o seller; devuelve la factura emitida
  con sus líneas.

El detalle incluye `id`, `number`, `status`, `customer_id`, `user_id`,
`payment_term_id`, `payment_term`, `currency_id`, `currency`, `subtotal`,
`total`, `delivery_address`, `notes`, `created_at`, `items` y `history`. No
expone asignaciones por lote, `lot_id`, `lots.stock`, `lots.reserved`, costos,
bodegas ni datos de otros clientes.

### Roles de pedidos

| Acción                                | `customer` | `admin` | `seller`                 | Otros roles |
| ------------------------------------- | ---------- | ------- | ------------------------ | ----------- |
| `POST /orders`                        | Propio     | Cualquiera | Cliente asignado      | `403`       |
| `GET /orders` y `GET /orders/:id`     | Propios    | Todos   | Todos                    | `403`       |
| Ítems en `draft`                      | Propios    | Cualquiera | Cliente asignado      | `403`       |
| `draft → request`                     | Propio     | `403`   | `403`                    | `403`       |
| `draft → generate`, `request → generate` | `403`   | Sí      | Cliente asignado         | `403`       |
| `generate → invoiced`                 | `403`      | Sí      | Sí                       | `403`       |
| Cancelar                              | Propios en `draft`/`request` | Cualquiera no terminal | Cliente asignado no terminal | `403` |
| `PUT /orders/:id/payment-term`        | `403`      | En `draft`/`request` | Cliente asignado en `draft`/`request` | `403` |
| CRUD `/order-statuses` lectura        | Sí         | Sí      | Sí                       | `403`       |
| CRUD `/order-statuses` escritura      | `403`      | Sí      | `403`                    | `403`       |

Sin token o con token inválido/expirado: `401 Unauthorized`. Usuario bloqueado:
`403 User is blocked`. `customer` sin vínculo: `403 Customer profile is not
linked`. `customer` sin lista: `403 Customer price list is not assigned`.

### Errores del ciclo de vida

| Código | Situación                                            | Cuerpo esperado |
| ------ | ---------------------------------------------------- | --------------- |
| `400`  | Falta `status`, `product_id`, `item_state_id`, `quantity` o `customer_id` interno | `{ "message": "<campo> is required" }` |
| `401`  | Token ausente, inválido o expirado                   | `{ "message": "Unauthorized" }` |
| `403`  | Rol sin permiso, cliente no vinculado/sin lista o seller no asignado | `Forbidden` o mensaje específico |
| `404`  | Pedido, ítem, estado o cliente inexistente/oculto    | `... not found` |
| `409`  | Stock o saldo de billetera insuficiente, par duplicado, estado en uso | Mensaje específico |
| `422`  | Transición inválida, término faltante/inactivo, estado no vendible, pedido no editable, id inválido | `{ "errors": { ... } }` |
| `503`  | Sin moneda por defecto o faltan estados base         | Mensaje específico |
| `500`  | Error interno                                        | `{ "message": "Internal server error" }` |

## Vendedores por cliente (customer_sellers)

Cada cliente puede tener **como máximo un vendedor responsable**, mientras que
un vendedor puede tener **muchos clientes**. La relación vive en la tabla
puente `customer_sellers` (modelo `CustomerSeller`) y no modifica la tabla
`customers`. Está preparada para evolucionar a varios vendedores por cliente en
el futuro.

Reglas de negocio:

- `customer_id` es obligatorio y único: un cliente no puede tener dos
  vendedores. Un segundo `POST` para el mismo cliente responde `409` y la
  restricción única de la base de datos también protege dos peticiones
  simultáneas.
- `seller_id` debe referenciar un usuario existente con rol `seller` y que no
  esté bloqueado. La comprobación se hace al asignar o reasignar, no en cada
  lectura.
- `assigned_at` lo asigna el servidor y se renueva al reasignar. El cliente no
  puede enviarlo y nunca se exponen `createdAt` ni `updatedAt`.
- Borrar un cliente o un vendedor elimina la asignación por cascada
  (`ON DELETE CASCADE`), sin bloquear el borrado.
- `PUT` no puede cambiar `customer_id`; enviar otro valor responde `422`. Para
  mover la asignación a otro cliente se elimina y se crea de nuevo.
- Eliminar una asignación no borra ni al cliente ni al vendedor.
- Las respuestas incluyen `customer` (`id`, `fullName`, `email`, `direction`) y
  `seller` (`id`, `username`, `email`, `name`) mediante `include` de Sequelize,
  sin N+1.

Roles:

- Lectura (`GET`): `admin`, `dispatcher` y `seller` (solo sus asignaciones).
- Escritura (`POST`, `PUT`, `DELETE`): `admin` y `seller` (solo las propias).
- `manager_warehouse`, `customer` y `support` reciben `403`.

| Endpoint                       | `admin` | `seller`           | `dispatcher` | `manager_warehouse` | `support` | `customer` |
| ------------------------------ | ------- | ------------------ | ------------ | ------------------- | --------- | ---------- |
| `GET /customer-sellers`        | ✅      | ✅ solo propias    | ✅           | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `GET /customer-sellers/:id`    | ✅      | ✅ solo propias    | ✅           | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `POST /customer-sellers`       | ✅      | ✅ solo a sí mismo | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `PUT /customer-sellers/:id`    | ✅      | ✅ solo propias    | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `DELETE /customer-sellers/:id` | ✅      | ✅ solo propias    | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |

### `POST /customer-sellers`

Requiere `customer_id` y `seller_id`. El `admin` puede asignar cualquier
vendedor válido; un `seller` solo puede asignarse a sí mismo.

```bash
curl -X POST http://localhost:3001/customer-sellers \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":8,"seller_id":12}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "customer_id": 8,
  "seller_id": 12,
  "assigned_at": "2026-10-29T16:00:00.000Z",
  "customer": {
    "id": 8,
    "fullName": "Juan Pérez",
    "email": "juan@example.com",
    "direction": "Av. Monseñor Rivero 123"
  },
  "seller": {
    "id": 12,
    "username": "vendedor1",
    "email": "vendedor1@farmamad.com",
    "name": "Carlos Gómez"
  }
}
```

### `GET /customer-sellers`

Lista las asignaciones ordenadas por `customer_id` ascendente. Filtros
opcionales exactos: `customer_id` y `seller_id`. Un `seller` siempre ve solo
sus filas: si omite `seller_id` se filtra por su token y si pide otro vendedor
recibe `403`. Si el cliente filtrado no tiene asignación devuelve `[]`.

```bash
curl "http://localhost:3001/customer-sellers?seller_id=12" \
  -H "Authorization: Bearer <jwt>"
```

```json
[
  {
    "id": 1,
    "customer_id": 8,
    "seller_id": 12,
    "assigned_at": "2026-10-29T16:00:00.000Z",
    "customer": {
      "id": 8,
      "fullName": "Juan Pérez",
      "email": "juan@example.com",
      "direction": "Av. Monseñor Rivero 123"
    },
    "seller": {
      "id": 12,
      "username": "vendedor1",
      "email": "vendedor1@farmamad.com",
      "name": "Carlos Gómez"
    }
  }
]
```

### `GET /customer-sellers/:id`

Devuelve una asignación con sus datos anidados. Un `seller` solo puede
consultar las propias; otra asignación responde `403`. Un id inválido responde
`422` y una asignación inexistente `404 Assignment not found`.

```bash
curl http://localhost:3001/customer-sellers/1 \
  -H "Authorization: Bearer <jwt>"
```

### `PUT /customer-sellers/:id`

Reasigna el vendedor y responde `202` con `assigned_at` renovado. Requiere
`seller_id`. El `admin` puede reasignar a cualquier vendedor válido; un
`seller` solo puede modificar una asignación propia y el nuevo vendedor debe ser
él mismo. `customer_id` es inmutable: si se envía otro valor responde `422`.

```bash
curl -X PUT http://localhost:3001/customer-sellers/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"seller_id":15}'
```

### `DELETE /customer-sellers/:id`

Elimina solo la asignación y responde `204` sin cuerpo. El cliente queda sin
vendedor y puede asignarse de nuevo; ni el cliente ni el usuario vendedor se
borran.

```bash
curl -X DELETE http://localhost:3001/customer-sellers/1 \
  -H "Authorization: Bearer <jwt>"
```

### Errores del módulo

| Código | Cuerpo                                                             |
| ------ | ------------------------------------------------------------------ |
| `400`  | `{ "message": "customer_id and seller_id are required" }`          |
| `400`  | `{ "message": "seller_id is required" }`                           |
| `401`  | `{ "message": "Unauthorized" }`                                    |
| `403`  | `{ "message": "Forbidden" }`                                       |
| `404`  | `{ "message": "Assignment not found" }`                            |
| `409`  | `{ "message": "Customer already has a seller" }`                   |
| `422`  | `{ "errors": { "seller_id": "Invalid seller" } }`                  |
| `422`  | `{ "errors": { "customer_id": "Invalid customer" } }`              |
| `422`  | `{ "errors": { "customer_id": "customer_id cannot be changed" } }` |
| `422`  | `{ "errors": { "id": "Invalid assignment id" } }`                  |

## Impuestos (taxes)

Catálogo de impuestos para los pedidos futuros (HU-27). Cada fila de la tabla
`taxes` (modelo `Tax`) tiene un `code` único ignorando mayúsculas, un `name`,
una `rate` porcentual, una `description` opcional y `is_active`. `rate` se
guarda como `DECIMAL(5,2)` y la base de datos exige `0 <= rate <= 100`; por
ejemplo `16.00` significa `16 %`, no un monto. No hay datos iniciales: el
catálogo arranca vacío.

Reglas de negocio:

- `code` se normaliza a mayúsculas, mide entre 2 y 20 caracteres, solo acepta
  `[A-Za-z0-9_]` y es único ignorando mayúsculas/minúsculas mediante un índice
  funcional sobre `LOWER(code)`. Es inmutable: un `PUT` que lo envíe lo ignora.
- `name` no es único y mide entre 2 y 100 caracteres. `description` admite hasta
  255 caracteres y se devuelve como `null` cuando no se envía o llega vacía.
- `is_active` es booleano y vale `true` por defecto. Desactivar un impuesto con
  `PUT` no lo borra.
- `DELETE` es físico. Si una tabla futura lo referencia, la FK `RESTRICT` impide
  el borrado y la API responde `409`.
- Los timestamps `createdAt` y `updatedAt` nunca se exponen.
- Las respuestas se serializan con `id`, `code`, `name`, `rate`, `description`
  e `is_active`.
- Este catálogo **no** se usa en compras: `purchases` y `purchase_items` no
  cambian en esta historia (el impuesto por línea de compra es HU-30).

Roles:

- Lectura (`GET`): `admin`, `seller`, `manager_warehouse` y `dispatcher`.
- Escritura (`POST`, `PUT`, `DELETE`): solo `admin`.
- `customer` y `support` reciben `403`.

| Endpoint          | `admin` | `seller` | `manager_warehouse` | `dispatcher` | `support` | `customer` |
| ----------------- | ------- | -------- | ------------------- | ------------ | --------- | ---------- |
| `GET /taxes`      | ✅      | ✅       | ✅                  | ✅           | ❌ `403`  | ❌ `403`   |
| `GET /taxes/:id`  | ✅      | ✅       | ✅                  | ✅           | ❌ `403`  | ❌ `403`   |
| `POST /taxes`     | ✅      | ❌ `403` | ❌ `403`            | ❌ `403`     | ❌ `403`  | ❌ `403`   |
| `PUT /taxes/:id`  | ✅      | ❌ `403` | ❌ `403`            | ❌ `403`     | ❌ `403`  | ❌ `403`   |
| `DELETE /taxes/:id` | ✅    | ❌ `403` | ❌ `403`            | ❌ `403`     | ❌ `403`  | ❌ `403`   |

### `POST /taxes`

Requiere `code`, `name` y `rate`; `description` e `is_active` son opcionales.

```bash
curl -X POST http://localhost:3001/taxes \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"code":"IVA","name":"Impuesto al Valor Agregado","rate":16,"description":"IVA general"}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "code": "IVA",
  "name": "Impuesto al Valor Agregado",
  "rate": 16,
  "description": "IVA general",
  "is_active": true
}
```

### `GET /taxes`

Lista todos los impuestos ordenados por `code` ascendente, incluidos los
inactivos. El filtro exacto opcional `?is_active=true|false` limita el
resultado.

```bash
curl "http://localhost:3001/taxes?is_active=true" \
  -H "Authorization: Bearer <jwt>"
```

```json
[
  {
    "id": 1,
    "code": "IGTF",
    "name": "Impuesto a las Grandes Transacciones Financieras",
    "rate": 3,
    "description": "IGTF",
    "is_active": true
  },
  {
    "id": 2,
    "code": "IVA",
    "name": "Impuesto al Valor Agregado",
    "rate": 16,
    "description": "IVA general",
    "is_active": true
  }
]
```

### `GET /taxes/:id`

Devuelve el detalle del impuesto, esté activo o inactivo.

```bash
curl http://localhost:3001/taxes/1 \
  -H "Authorization: Bearer <jwt>"
```

### `PUT /taxes/:id`

Actualiza `name`, `rate`, `description` e `is_active`; requiere al menos uno y
responde `202`. `code` es inmutable y se ignora si se envía. Cambiar la tasa no
recalcula compras ni pedidos existentes.

```bash
curl -X PUT http://localhost:3001/taxes/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"rate":3.5,"is_active":false}'
```

### `DELETE /taxes/:id`

Borra físicamente el impuesto y responde `204` sin cuerpo. Para dejar de usarlo
sin borrarlo, actualícelo con `"is_active": false`. Si otra tabla lo referencia,
responde `409 Tax is in use`.

```bash
curl -X DELETE http://localhost:3001/taxes/1 \
  -H "Authorization: Bearer <jwt>"
```

### Errores del módulo

| Código | Cuerpo                                                       |
| ------ | ------------------------------------------------------------ |
| `400`  | `{ "message": "code, name and rate are required" }`          |
| `400`  | `{ "message": "At least one field is required" }`            |
| `401`  | `{ "message": "Unauthorized" }`                              |
| `403`  | `{ "message": "Forbidden" }`                                 |
| `404`  | `{ "message": "Tax not found" }`                             |
| `409`  | `{ "message": "Tax already exists" }`                        |
| `409`  | `{ "message": "Tax is in use" }`                             |
| `422`  | `{ "errors": { "rate": "rate must be between 0 and 100" } }` |
| `422`  | `{ "errors": { "rate": "rate must have at most 2 decimals" } }` |
| `422`  | `{ "errors": { "id": "Invalid tax id" } }`                   |
| `422`  | `{ "errors": { "is_active": "Invalid is_active" } }`         |

## Tipos de métodos de pago (method_payment_types)

Catálogo de categorías de pago (HU-28). Cada fila de `method_payment_types`
(modelo `MethodPaymentType`) representa un tipo de método de pago y define:

- `code`: clave estable, mayúsculas, única ignorando mayúsculas/minúsculas e
  inmutable.
- `name`: nombre visible.
- `currency_id`: moneda del tipo (HU-22), heredada por todos sus métodos de
  pago concretos (HU-29).
- `fields`: arreglo JSONB con la definición de los datos que debe enviar un
  método de pago de ese tipo.
- `description`: texto opcional.
- `is_active`: bandera para dejar de ofrecerlo sin borrarlo.

Las respuestas serializan `id`, `code`, `name`, `currency_id`, `currency`
(`id`, `code`, `name`, `symbol`), `fields`, `description` e `is_active`. Los
timestamps no se exponen y la moneda se resuelve con un `include` de
Sequelize, sin consultas N+1.

Reglas de negocio:

- `code` se normaliza a mayúsculas, mide entre 2 y 30 caracteres, solo acepta
  `[A-Z0-9_]` y es único ignorando mayúsculas mediante un índice funcional
  sobre `LOWER(code)`. Un `PUT` que lo envíe lo ignora.
- `name` es obligatorio, de 1 a 100 caracteres. `description` admite hasta 255
  caracteres y se devuelve como `null` cuando no se envía o llega vacía.
- `currency_id` debe existir y estar activa al crear el tipo o al cambiarlo.
  Si no, responde `422` con `{ "errors": { "currency_id": "Invalid currency" } }`.
- `fields` se valida en el servidor según RF-05. Un `fields` inválido responde
  `422` con `{ "errors": { "fields": "Invalid fields definition" } }`.
- `fields` y `currency_id` solo se pueden cambiar mientras el tipo no tenga
  métodos de pago concretos. Si ya tiene, responde `409` con
  `{ "message": "Payment type has methods" }`.
- `DELETE` es físico y responde `204`; si el tipo tiene métodos, responde
  `409`. Para dejar de usarlo sin borrarlo, use `PUT` con `is_active = false`.

### Definición de `fields`

`fields` es un arreglo de máximo 20 objetos. Cada objeto tiene exactamente
`key`, `label`, `type`, `required` y, opcionalmente, `max_length`; no se
admiten propiedades adicionales ni claves repetidas.

| Propiedad    | Regla                                                          |
| ------------ | -------------------------------------------------------------- |
| `key`        | Requerido, `^[a-z][a-z0-9_]{1,40}$`, único dentro del tipo.     |
| `label`      | Requerido, 1–100 caracteres.                                    |
| `type`       | Requerido: `text`, `email`, `phone`, `integer` o `boolean`.     |
| `required`   | Requerido, booleano estricto.                                   |
| `max_length` | Opcional, entero 1–255; solo para `text`, `email` y `phone`.    |

```json
[
  {
    "key": "email",
    "label": "Correo de PayPal",
    "type": "email",
    "required": true,
    "max_length": 150
  }
]
```

### Roles

- Lectura (`GET`): `admin`, `seller` y `dispatcher`.
- Escritura (`POST`, `PUT`, `DELETE`): solo `admin`.
- `manager_warehouse`, `support` y `customer` reciben `403`.

### Semilla inicial

El seeder `seeders/20260910000006-method-payment-types.js` crea `PAYPAL`,
`BINANCE`, `BANK` y `PAGO_MOVIL` si no existen, resolviendo la moneda por
`code`: `PAYPAL → USD_BCV`, `BINANCE → USDT`, `BANK → VES` y
`PAGO_MOVIL → VES`. Es idempotente y **nunca sobrescribe** un tipo existente ni
sus `fields`. Requiere que el seeder de monedas (HU-22) se haya ejecutado; si
falta `USD_BCV`, `USDT` o `VES`, falla con un mensaje que indica ejecutar el
seeder de monedas.

```bash
npm run db:seed
```

### `POST /method-payment-types`

Crea un tipo (solo `admin`). Requiere `code`, `name` y `currency_id`;
`fields` es `[]` por defecto, `description` es opcional e `is_active` vale
`true` por defecto.

```bash
curl -X POST http://localhost:3001/method-payment-types \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"code":"PAYPAL","name":"PayPal","currency_id":3,"description":"Pagos por PayPal","fields":[{"key":"email","label":"Correo de PayPal","type":"email","required":true}]}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "code": "PAYPAL",
  "name": "PayPal",
  "currency_id": 3,
  "currency": {
    "id": 3,
    "code": "USD_BCV",
    "name": "Dólar BCV",
    "symbol": "$"
  },
  "fields": [
    {
      "key": "email",
      "label": "Correo de PayPal",
      "type": "email",
      "required": true
    }
  ],
  "description": "Pagos por PayPal",
  "is_active": true
}
```

### `GET /method-payment-types`

Lista todos los tipos ordenados por `code` ascendente, incluidos los inactivos,
con su moneda anidada. Filtros exactos opcionales: `?currency_id=` y
`?is_active=true|false`.

```bash
curl "http://localhost:3001/method-payment-types?currency_id=1&is_active=true" \
  -H "Authorization: Bearer <jwt>"
```

### `GET /method-payment-types/:id`

Devuelve el detalle del tipo, esté activo o inactivo, o `404` si no existe.

```bash
curl http://localhost:3001/method-payment-types/1 \
  -H "Authorization: Bearer <jwt>"
```

### `PUT /method-payment-types/:id`

Actualiza `name`, `description`, `is_active` y, si el tipo no tiene métodos,
`currency_id` y `fields` (solo `admin`). Responde `202`. `code` es inmutable y
se ignora si se envía. Si el tipo ya tiene métodos y se intenta cambiar
`currency_id` o `fields`, responde `409 Payment type has methods`.

```bash
curl -X PUT http://localhost:3001/method-payment-types/3 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Banco Nacional (VES)","description":"Cuentas en bolívares"}'
```

### `DELETE /method-payment-types/:id`

Borra físicamente el tipo y responde `204` sin cuerpo. Si tiene métodos de pago
concretos responde `409 Payment type has methods`; para dejar de usarlo sin
borrarlo, actualícelo con `"is_active": false`.

```bash
curl -X DELETE http://localhost:3001/method-payment-types/3 \
  -H "Authorization: Bearer <jwt>"
```

### Errores del módulo

| Código | Cuerpo                                                     |
| ------ | ---------------------------------------------------------- |
| `400`  | `{ "message": "code, name and currency_id are required" }` |
| `400`  | `{ "message": "At least one field is required" }`          |
| `401`  | `{ "message": "Unauthorized" }`                            |
| `403`  | `{ "message": "Forbidden" }`                               |
| `404`  | `{ "message": "Payment type not found" }`                  |
| `409`  | `{ "message": "Payment type already exists" }`             |
| `409`  | `{ "message": "Payment type has methods" }`                |
| `422`  | `{ "errors": { "currency_id": "Invalid currency" } }`      |
| `422`  | `{ "errors": { "fields": "Invalid fields definition" } }`  |
| `422`  | `{ "errors": { "id": "Invalid payment type id" } }`        |
| `422`  | `{ "errors": { "is_active": "Invalid is_active" } }`       |
| `422`  | `{ "errors": { "currency_id": "Invalid currency_id" } }`   |

## Métodos de pago registrados (method_payments)

Registro de los datos reales de cobro (HU-29). Cada fila de `method_payments`
(modelo `MethodPayment`) pertenece a un tipo de método de pago (HU-28) y guarda
una etiqueta, los datos variables del método en `details` (JSONB) y un estado
activo. La moneda **no** se guarda en el método: se hereda del tipo y se
devuelve anidada en la respuesta.

Ejemplos de `details` por tipo:

- PayPal: `{ "email": "pagos@farmamad.com" }`
- Binance: `{ "wallet_address": "T...", "network": "TRC20" }`
- Banco Nacional: `{ "bank_name": "Banesco", "account_number": "0134...", "account_type": "corriente", "holder_name": "Farmamad C.A.", "holder_id": "J-12345678-9" }`
- Pago Móvil: `{ "bank_name": "Banesco", "phone": "04141234567", "holder_id": "V-12345678" }`

Reglas de negocio:

- `method_payment_type_id` es obligatorio y debe existir, estar activo y tener
  una moneda activa al crear un método. Es inmutable: un `PUT` que envíe otro
  valor responde `422`.
- `label` es obligatoria, de 1 a 100 caracteres y única dentro del tipo
  ignorando mayúsculas mediante un índice funcional sobre `LOWER(label)`.
- `details` es un objeto plano obligatorio (ni arreglo ni `null`) y se valida
  en el servidor contra `method_payment_types.fields` en cada creación y
  actualización, dentro de una transacción.
- `is_active` vale `true` por defecto. Desactivar un método con `PUT` no lo
  borra. Reactivarlo exige que el tipo y su moneda vuelvan a estar activos.
- `currency_id` y `currency` enviados en el cuerpo se ignoran; la moneda de la
  respuesta siempre se obtiene del tipo.
- `DELETE` es físico y responde `204`. Si otra tabla lo referencia, la FK
  `RESTRICT` impide el borrado y la API responde `409 Payment method is in use`.
- Los timestamps `createdAt` y `updatedAt` nunca se exponen.
- Los `details` nunca se escriben en logs ni en mensajes de error. No guarde
  credenciales, tokens, claves privadas, CVV ni datos completos de tarjetas.

Las respuestas serializan `id`, `method_payment_type_id`, `label`, `details`,
`is_active`, `currency_id`, `currency` (`id`, `code`, `name`, `symbol`) y
`method_payment_type` (`id`, `code`, `name`). La lista resuelve tipo y moneda
con un `include` de Sequelize, sin consultas N+1.

### Validación dinámica de `details`

| Tipo      | Regla                                                                         |
| --------- | ----------------------------------------------------------------------------- |
| `text`    | String, se recorta, no vacío si es requerido, `max_length` (255 por defecto). |
| `email`   | String con formato de correo, máximo 254 caracteres.                          |
| `phone`   | String de 6–20 caracteres con dígitos, `+`, espacios o guiones.               |
| `integer` | Entero (número o string numérico entero); no admite decimales.                |
| `boolean` | Booleano estricto (`true`/`false`); no admite strings.                        |

- Las claves requeridas ausentes, `null` o vacías responden `422` con
  `{ "errors": { "details.<clave>": "<clave> is required" } }`.
- Las claves no definidas en el tipo responden
  `{ "errors": { "details.<clave>": "Unknown field" } }`.
- Los textos se devuelven recortados. Un campo opcional ausente, `null` o vacío
  se omite de `details`.
- No se permiten objetos anidados ni arreglos como valores.

### Roles

- Lectura (`GET`): `admin`, `seller` y `dispatcher`.
- Escritura (`POST`, `PUT`, `DELETE`): solo `admin`.
- `manager_warehouse`, `support` y `customer` reciben `403`.

| Endpoint                      | `admin` | `seller` | `dispatcher` | `manager_warehouse` | `support` | `customer` |
| ----------------------------- | ------- | -------- | ------------ | ------------------- | --------- | ---------- |
| `GET /method-payments`        | ✅      | ✅       | ✅           | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `GET /method-payments/:id`    | ✅      | ✅       | ✅           | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `POST /method-payments`       | ✅      | ❌ `403` | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `PUT /method-payments/:id`    | ✅      | ❌ `403` | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |
| `DELETE /method-payments/:id` | ✅      | ❌ `403` | ❌ `403`     | ❌ `403`            | ❌ `403`  | ❌ `403`   |

### `POST /method-payments` (PayPal)

Crea un método (solo `admin`). Requiere `method_payment_type_id`, `label` y
`details`; `is_active` es opcional.

```bash
curl -X POST http://localhost:3001/method-payments \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"method_payment_type_id":1,"label":"PayPal Farmamad","details":{"email":"pagos@farmamad.com"}}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "method_payment_type_id": 1,
  "label": "PayPal Farmamad",
  "details": { "email": "pagos@farmamad.com" },
  "is_active": true,
  "currency_id": 3,
  "currency": {
    "id": 3,
    "code": "USD_BCV",
    "name": "Dólar BCV",
    "symbol": "$"
  },
  "method_payment_type": { "id": 1, "code": "PAYPAL", "name": "PayPal" }
}
```

### `POST /method-payments` (Binance)

```bash
curl -X POST http://localhost:3001/method-payments \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"method_payment_type_id":2,"label":"Binance Farmamad","details":{"wallet_address":"T-1234567890","network":"TRC20"}}'
```

La respuesta hereda la moneda de `BINANCE` (por ejemplo `USDT`) y valida que
`wallet_address` y `network` existan en los `fields` del tipo.

### `POST /method-payments` (Banco Nacional)

```bash
curl -X POST http://localhost:3001/method-payments \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"method_payment_type_id":3,"label":"Banesco cuenta principal","details":{"bank_name":"Banesco","account_number":"01340000000000000000","account_type":"corriente","holder_name":"Farmamad C.A.","holder_id":"J-12345678-9"}}'
```

La respuesta hereda `currency_id` de `BANK` (por ejemplo `VES`).

### `POST /method-payments` (Pago Móvil)

```bash
curl -X POST http://localhost:3001/method-payments \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"method_payment_type_id":4,"label":"Pago Móvil Banesco","details":{"bank_name":"Banesco","phone":"04141234567","holder_id":"V-12345678"}}'
```

### `GET /method-payments`

Lista todos los métodos ordenados por `method_payment_type_id` y `label`
ascendente, incluidos los inactivos, con su tipo y moneda anidados. Filtros
exactos opcionales: `?method_payment_type_id=`, `?currency_id=` y
`?is_active=true|false`.

```bash
curl "http://localhost:3001/method-payments?method_payment_type_id=3" \
  -H "Authorization: Bearer <jwt>"
```

```json
[
  {
    "id": 2,
    "method_payment_type_id": 3,
    "label": "Banesco cuenta principal",
    "details": {
      "bank_name": "Banesco",
      "account_number": "01340000000000000000",
      "account_type": "corriente",
      "holder_name": "Farmamad C.A.",
      "holder_id": "J-12345678-9"
    },
    "is_active": true,
    "currency_id": 1,
    "currency": { "id": 1, "code": "VES", "name": "Bolívar", "symbol": "Bs" },
    "method_payment_type": { "id": 3, "code": "BANK", "name": "Banco Nacional" }
  }
]
```

### `GET /method-payments/:id`

Devuelve el detalle del método, esté activo o inactivo, o `404` si no existe.

```bash
curl http://localhost:3001/method-payments/1 \
  -H "Authorization: Bearer <jwt>"
```

### `PUT /method-payments/:id`

Actualiza `label`, `details` e `is_active`; requiere al menos uno y responde
`202`. `method_payment_type_id` es inmutable: si se envía con otro valor
responde `422`. `currency_id` y `currency` se ignoran. Reactivar
(`"is_active": true`) exige que el tipo y su moneda estén activos.

```bash
curl -X PUT http://localhost:3001/method-payments/1 \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"label":"PayPal principal","details":{"email":"tesoreria@farmamad.com"}}'
```

### `DELETE /method-payments/:id`

Borra físicamente el método y responde `204` sin cuerpo. Para dejar de usarlo
sin borrarlo, actualícelo con `"is_active": false`. Si otra tabla lo referencia,
responde `409 Payment method is in use`.

```bash
curl -X DELETE http://localhost:3001/method-payments/1 \
  -H "Authorization: Bearer <jwt>"
```

### Errores del módulo

| Código | Cuerpo                                                                                   |
| ------ | ---------------------------------------------------------------------------------------- |
| `400`  | `{ "message": "method_payment_type_id, label and details are required" }`                |
| `400`  | `{ "message": "At least one field is required" }`                                        |
| `401`  | `{ "message": "Unauthorized" }`                                                          |
| `403`  | `{ "message": "Forbidden" }`                                                             |
| `404`  | `{ "message": "Payment method not found" }`                                              |
| `409`  | `{ "message": "Payment method already exists" }`                                         |
| `409`  | `{ "message": "Payment method is in use" }`                                              |
| `422`  | `{ "errors": { "details.email": "email is required" } }`                                 |
| `422`  | `{ "errors": { "details.cvv": "Unknown field" } }`                                       |
| `422`  | `{ "errors": { "method_payment_type_id": "Invalid payment type" } }`                     |
| `422`  | `{ "errors": { "method_payment_type_id": "method_payment_type_id cannot be changed" } }` |
| `422`  | `{ "errors": { "id": "Invalid payment method id" } }`                                    |
| `422`  | `{ "errors": { "is_active": "Invalid is_active" } }`                                     |

## Facturas (`invoices`, `invoice_items`) — HU-40

Las facturas son un comprobante **inmutable** de una venta. Esta entrega incluye
las migraciones reversibles, los modelos, la secuencia de numeración, el
servicio de emisión transaccional y la consulta de facturas. No existen
endpoints de escritura: una factura no se puede crear, editar ni eliminar por
API. La creación ocurre dentro de la transición `generate → invoiced` de
pedidos (HU-39).

> **Integración con pedidos (HU-39/#63).** La transición `generate → invoiced`
> crea la factura, consume la reserva de lotes y agrega los eventos
> `status_changed` e `invoice_issued`. La factura se puede consultar con
> `GET /invoices/:id` o `GET /orders/:id/invoice`. El servicio exige un término
> de pago activo y calcula `due_date`. `invoices.payment_term_id` es
> obligatorio y tiene FK a `payment_terms` (HU-41); `order_id` e
> `invoice_items.order_item_id` siguen nullable y sin FK.

### Tablas y numeración

- `invoices`: cabecera con `number` único asignado por
  `invoices_number_seq`, snapshot de `customer_id`, `invoiced_by_user_id`,
  `currency_id`, `payment_term_id`, importes, `payment_status`
  (`pending`, `partial`, `paid`), `issued_at`, `due_date` y `notes`.
- `invoice_items`: líneas inmutables con snapshots de nombre de producto,
  referencia y nombre del estado, además de `quantity`, `unit_price` y
  `subtotal`.
- `invoices_number_seq`: empieza en 1 y avanza de uno en uno. Los huecos por
  transacciones fallidas son aceptables.
- `order_id` es único, por lo que un pedido puede tener como máximo una
  factura. La restricción `(invoice_id, order_item_id)` evita duplicar una
  línea del pedido.
- `tax_amount` es siempre `0` en esta HU; `paid_amount` nace en `0` y
  `payment_status` en `pending`. El historial de pagos vive en la sección HU-43.
- `payment_term_id` es obligatorio y se copia del pedido como snapshot
  inmutable. `due_date = issued_at + payment_terms.days`; para contado
  (`days = 0`) es la fecha de emisión. Un término inexistente o inactivo hace
  que la emisión falle con `422` y no consuma la reserva.

### Roles

| Acción                                 | `customer`  | `admin` | `seller` | Otros roles |
| -------------------------------------- | ----------- | ------- | -------- | ----------- |
| `GET /invoices`                        | No (`403`)  | Sí      | Sí       | `403`       |
| `GET /invoices/:id`                    | Solo propia | Todas   | Todas    | `403`       |
| Emitir factura (`generate → invoiced`) | No (`403`)  | Sí      | Sí       | `403`       |

Sin token, o con token inválido/expirado, responde `401 Unauthorized`. Un
usuario bloqueado responde `403 User is blocked`. Un `customer` sin
`users.customer_id` responde `403 Customer profile is not linked`; por eso, en
esta rama, la consulta de un cliente queda bloqueada hasta integrar HU-39.

### `GET /invoices`

Solo `admin` y `seller`. Devuelve resúmenes sin líneas, ordenados por
`issued_at` descendente y luego `id` descendente. Filtros exactos opcionales:

- `?order_id=<id>`
- `?customer_id=<id>`
- `?number=<número>`
- `?payment_status=pending|partial|paid`

Un filtro inválido responde `422` con `{ "errors": { "<filtro>": "..." } }`.

```bash
curl "http://localhost:3001/invoices?payment_status=pending&customer_id=8" \
  -H "Authorization: Bearer <jwt-admin>"
```

Respuesta `200`:

```json
[
  {
    "id": 1,
    "number": 1,
    "order_id": 10,
    "order_number": null,
    "customer_id": 8,
    "customer": {
      "id": 8,
      "fullName": "Cliente Demo",
      "email": "cliente@example.com",
      "direction": "Av. Monseñor Rivero 123"
    },
    "currency_id": 3,
    "currency": {
      "id": 3,
      "code": "USD_BCV",
      "name": "Dólar BCV",
      "symbol": "$"
    },
    "payment_term_id": 3,
    "subtotal": 25,
    "tax_amount": 0,
    "total": 25,
    "paid_amount": 0,
    "balance_due": 25,
    "payment_status": "pending",
    "issued_at": "2026-11-01T12:00:00.000Z",
    "due_date": "2026-11-16",
    "notes": "Factura generada desde el pedido 10"
  }
]
```

### `GET /invoices/:id`

`admin`, `seller` o el `customer` dueño. Un id inválido responde `422` con
`{ "errors": { "id": "Invalid invoice id" } }`. Una factura inexistente o de
otro cliente responde `404` con `{ "message": "Invoice not found" }` para no
revelar su existencia. El cliente no recibe `invoiced_by`; `admin` y `seller`
sí lo reciben.

```bash
curl http://localhost:3001/invoices/1 \
  -H "Authorization: Bearer <jwt-admin>"
```

Respuesta `200`:

```json
{
  "id": 1,
  "number": 1,
  "order_id": 10,
  "order_number": null,
  "customer_id": 8,
  "customer": {
    "id": 8,
    "fullName": "Cliente Demo",
    "email": "cliente@example.com",
    "direction": "Av. Monseñor Rivero 123"
  },
  "invoiced_by": { "id": 1, "username": "admin", "email": "admin@example.com" },
  "currency_id": 3,
  "currency": {
    "id": 3,
    "code": "USD_BCV",
    "name": "Dólar BCV",
    "symbol": "$"
  },
  "payment_term_id": 3,
  "payment_term": {
    "id": 3,
    "code": "credit_15",
    "name": "Crédito 15 días",
    "days": 15
  },
  "subtotal": 25,
  "tax_amount": 0,
  "total": 25,
  "paid_amount": 0,
  "balance_due": 25,
  "payment_status": "pending",
  "issued_at": "2026-11-01T12:00:00.000Z",
  "due_date": "2026-11-16",
  "notes": "Factura generada desde el pedido 10",
  "items": [
    {
      "order_item_id": 20,
      "product_id": 15,
      "product_name": "Ibuprofeno 400 mg",
      "product_reference": "IBU-400",
      "item_state_id": 1,
      "item_state_name": "sellable",
      "quantity": 2,
      "unit_price": 12.5,
      "subtotal": 25
    }
  ]
}
```

No se exponen costos, márgenes, lotes, ubicaciones, datos de otros clientes ni
columnas de auditoría.

### Integración con el ciclo de vida de pedidos

- La transición `generate → invoiced` de HU-39 ejecuta la emisión en la misma
  transacción que el cambio de estado y el consumo de reservas, con bloqueo
  `FOR UPDATE`, descuento de `lots.stock` y `stocks.quantity`, y los eventos
  `status_changed` e `invoice_issued`.
- `GET /orders/:id/invoice` (HU-39/#63) aplica primero la visibilidad del
  pedido y luego la propiedad de la factura.
- Un `customer` ve solo las facturas de su `users.customer_id`; un pedido,
  factura o cliente ajeno responde `404` para no revelar su existencia.
- Las FK `invoices.order_id → orders.id` e
  `invoice_items.order_item_id → order_items.id` siguen pendientes de una
  migración posterior.

### Errores del módulo

| Código | Situación                           | Cuerpo                                            |
| ------ | ----------------------------------- | ------------------------------------------------- |
| `401`  | Token ausente, inválido o expirado  | `{ "message": "Unauthorized" }`                   |
| `403`  | Rol sin permiso o usuario bloqueado | `{ "message": "Forbidden" }`                      |
| `403`  | Cliente sin vínculo                 | `{ "message": "Customer profile is not linked" }` |
| `404`  | Factura inexistente o ajena         | `{ "message": "Invoice not found" }`              |
| `409`  | El pedido ya tiene factura          | `{ "message": "Order already has an invoice" }`   |
| `422`  | Id o filtro inválido                | `{ "errors": { ... } }`                           |
| `422`  | Término requerido o inválido        | `{ "errors": { "payment_term_id": "..." } }`      |
| `500`  | Error interno                       | Manejador global existente                        |

## Billetera del cliente y pagos recibidos (HU-42)

Registro de los depósitos que recibe la empresa y del saldo disponible de cada
cliente (HU-42). Reutiliza `customers`, `currencies`, `method_payments`,
`method_payment_types` y `users`; no crea métodos de pago ni monedas nuevas.

Tablas nuevas, todas con migración reversible:

| Tabla                 | Contenido                                                                   |
| --------------------- | --------------------------------------------------------------------------- |
| `customer_wallets`    | Una billetera por `(customer_id, currency_id)` con `balance >= 0`.          |
| `payments`            | Pagos recibidos con cliente, método, moneda derivada y autor.               |
| `wallet_transactions` | Movimientos append-only (`deposit`, `invoice_payment`) con `balance_after`. |

Además, `users.customer_id` (nullable, FK a `customers.id`) vincula una cuenta
con su perfil de cliente. Un usuario con rol `customer` sin ese vínculo recibe
`403 { "message": "Customer profile is not linked" }` en los endpoints de
billetera y pagos.

Reglas de negocio:

- La primera vez que se registra un pago se crea automáticamente la billetera
  del cliente y la moneda del método. Una segunda recarga reutiliza la misma
  billetera.
- `currency_id` no se acepta en el cuerpo: se copia de
  `method_payment_types.currency_id`. El método, su tipo y su moneda deben
  existir y estar activos.
- `amount` debe ser numérico, mayor que `0` y tener como máximo dos decimales.
  `reference` y `notes` se recortan y un texto vacío se guarda como `null`.
- El depósito es atómico: se bloquea o crea la billetera, se incrementa el
  saldo, se crea el pago y se agrega el movimiento `deposit` con
  `balance_after` dentro de la misma transacción. Dos depósitos simultáneos no
  pierden movimientos.
- `wallet_transactions` es append-only: la API no permite editar ni borrar
  movimientos. `payments` solo permite editar `reference`, `notes` y `paid_at`;
  `customer_id`, `method_payment_id`, `currency_id` y `amount` son inmutables.
- Un pago con asignaciones a facturas responde `409 Payment has allocations` al
  editarse o borrarse. El borrado revierte el depósito y nunca deja saldo
  negativo.

### Roles

| Acción                                   | `customer`   | `admin` | `seller` | Otros roles |
| ---------------------------------------- | ------------ | ------- | -------- | ----------- |
| `POST /payments`                         | ❌ `403`     | ✅      | ✅       | ❌ `403`    |
| `GET /payments`                          | ❌ `403`     | ✅      | ✅       | ❌ `403`    |
| `GET /payments/:id`                      | Solo propio  | ✅      | ✅       | ❌ `403`    |
| `PUT /payments/:id`                      | ❌ `403`     | ✅      | ✅       | ❌ `403`    |
| `DELETE /payments/:id`                   | ❌ `403`     | ✅      | ❌ `403` | ❌ `403`    |
| `GET /customer-wallets`                  | Solo propias | ✅      | ✅       | ❌ `403`    |
| `GET /customer-wallets/:id`              | Solo propia  | ✅      | ✅       | ❌ `403`    |
| `GET /customer-wallets/:id/transactions` | Solo propia  | ✅      | ✅       | ❌ `403`    |

`admin` y `seller` deben enviar `?customer_id=` al listar billeteras; sin él la
respuesta es `400 { "message": "customer_id is required" }`. Un `customer`
puede omitirlo y siempre se resuelve su propio perfil. Una billetera o un pago
de otro cliente responde `404` para ocultar su existencia.

### `POST /payments`

Solo `admin` y `seller`. Requiere `customer_id`, `method_payment_id` y
`amount`; `paid_at` (por defecto ahora), `reference` y `notes` son opcionales.

```bash
curl -X POST http://localhost:3001/payments \
  -H "Authorization: Bearer <jwt-seller>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":8,"method_payment_id":3,"amount":100,"reference":"TRX-123","notes":"Depósito Binance"}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "customer_id": 8,
  "method_payment_id": 3,
  "method_payment": { "id": 3, "label": "Binance Farmamad" },
  "currency_id": 2,
  "currency": { "id": 2, "code": "USDT", "name": "Tether", "symbol": "$" },
  "amount": 100,
  "paid_at": "2026-11-01T12:00:00.000Z",
  "reference": "TRX-123",
  "notes": "Depósito Binance",
  "wallet": { "id": 5, "customer_id": 8, "currency_id": 2, "balance": 100 }
}
```

### `GET /payments` y `GET /payments/:id`

La lista (solo `admin` y `seller`) ordena por `paid_at` descendente e `id`
descendente. Filtros exactos opcionales: `?customer_id=`,
`?method_payment_id=`, `?currency_id=`, `?paid_from=YYYY-MM-DD` y
`?paid_to=YYYY-MM-DD`. El detalle también lo puede consultar el `customer`
dueño.

```bash
curl "http://localhost:3001/payments?customer_id=8&paid_from=2026-11-01" \
  -H "Authorization: Bearer <jwt-seller>"
```

### `PUT /payments/:id` y `DELETE /payments/:id`

`PUT` (solo `admin` y `seller`) actualiza `reference`, `notes` y `paid_at`, y
responde `202`. Enviar otro `customer_id`, `method_payment_id`, `currency_id` o
`amount` responde `422`. `DELETE` (solo `admin`) responde `204` y revierte el
saldo. Ambos responden `409` si el pago ya tiene asignaciones.

```bash
curl -X PUT http://localhost:3001/payments/1 \
  -H "Authorization: Bearer <jwt-seller>" \
  -H "Content-Type: application/json" \
  -d '{"reference":"TRX-456","notes":"Conciliado"}'
```

### `GET /customer-wallets`

Devuelve todas las billeteras del cliente con su moneda y saldo.

```bash
curl "http://localhost:3001/customer-wallets?customer_id=8" \
  -H "Authorization: Bearer <jwt-seller>"
```

```json
[
  {
    "id": 5,
    "customer_id": 8,
    "currency_id": 2,
    "currency": { "id": 2, "code": "USDT", "name": "Tether", "symbol": "$" },
    "balance": 100
  }
]
```

### `GET /customer-wallets/:id` y `GET /customer-wallets/:id/transactions`

El detalle devuelve la billetera. El historial devuelve los movimientos por
`createdAt` e `id` descendente con `transaction_type`, `amount`,
`balance_after`, `currency`, `payment_id`, `invoice_id`,
`payment_allocation_id`, `description` y `created_at`. Para `admin` y `seller`
incluye `created_by` (`{ id, username, email }`); el cliente no lo ve.

```bash
curl "http://localhost:3001/customer-wallets/5/transactions" \
  -H "Authorization: Bearer <jwt-customer>"
```

```json
[
  {
    "id": 1,
    "transaction_type": "deposit",
    "amount": 100,
    "balance_after": 100,
    "currency": { "id": 2, "code": "USDT", "name": "Tether", "symbol": "$" },
    "payment_id": 1,
    "invoice_id": null,
    "payment_allocation_id": null,
    "description": "Depósito Binance",
    "created_at": "2026-11-01T12:00:00.000Z"
  }
]
```

### Errores del módulo

| Código | Cuerpo esperado                                                                    |
| ------ | ---------------------------------------------------------------------------------- |
| `400`  | `{ "message": "customer_id, method_payment_id and amount are required" }`          |
| `400`  | `{ "message": "customer_id is required" }`                                         |
| `400`  | `{ "message": "At least one field is required" }`                                  |
| `401`  | `{ "message": "Unauthorized" }`                                                    |
| `403`  | `{ "message": "Forbidden" }`                                                       |
| `403`  | `{ "message": "Customer profile is not linked" }`                                  |
| `404`  | `{ "message": "Customer not found" }`                                              |
| `404`  | `{ "message": "Payment method not found" }`                                        |
| `404`  | `{ "message": "Payment not found" }`                                               |
| `404`  | `{ "message": "Wallet not found" }`                                                |
| `409`  | `{ "message": "Payment has allocations" }`                                         |
| `409`  | `{ "message": "Wallet balance would become negative" }`                            |
| `422`  | `{ "errors": { "amount": "amount must be a positive number with two decimals" } }` |
| `422`  | `{ "errors": { "method_payment_id": "Invalid payment method" } }`                  |
| `422`  | `{ "errors": { "<campo>": "<campo> cannot be changed" } }`                         |
| `422`  | `{ "errors": { "id": "Invalid payment id" } }`                                     |
| `422`  | `{ "errors": { "id": "Invalid wallet id" } }`                                      |
| `500`  | Error interno manejado por el handler global                                       |

## Aplicación de pagos a facturas y estado de pago (HU-43)

Permite aplicar el saldo de una billetera a una factura, consultar el historial
de pagos y saber si la factura está `pending`, `partial` o `paid`. Reutiliza
`invoices`, `payments`, `customer_wallets`, `wallet_transactions`, `currencies`,
`method_payments`, `method_payment_types` y `users`; no crea monedas, métodos de
pago ni variables de entorno nuevas.

Tablas y restricciones nuevas, con migración reversible:

| Elemento                                    | Contenido                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `payment_allocations`                       | Asignación inmutable de un pago a una factura, con `amount`, `applied_amount`, `exchange_rate`, `allocated_at` y autor. |
| `wallet_transactions.payment_allocation_id` | FK `RESTRICT` a `payment_allocations.id` e índice único: cada asignación genera exactamente un movimiento.              |
| `invoices`                                  | CHECK `invoices_paid_amount_within_total` (`paid_amount <= total`) e índice de `payment_status`.                        |

Reglas de negocio:

- Un pago no se puede aplicar dos veces a la misma factura: la pareja
  `(payment_id, invoice_id)` es única y un duplicado responde
  `409 Payment already allocated to this invoice`.
- El pago debe pertenecer al mismo cliente que la factura. Si no, responde
  `422` con `{ "errors": { "payment_id": "Payment does not belong to invoice customer" } }`.
- `amount` se descuenta de la billetera en la moneda del pago y debe ser mayor
  que `0`, con máximo dos decimales y no mayor al saldo disponible.
- `exchange_rate = paymentCurrency.rate ÷ invoiceCurrency.rate` y
  `applied_amount = round2(amount × exchange_rate)` se acreditan a la factura.
  Si `applied_amount` supera `total - paid_amount` responde `422` con
  `{ "errors": { "amount": "Amount exceeds invoice balance" } }`.
- Una factura ya pagada responde `409 Invoice is already paid`.
- Todo ocurre en una única transacción: se bloquean factura, pago y billetera,
  se crea la asignación, se debita la billetera, se agrega el movimiento
  `invoice_payment` con `amount` negativo e `invoice_id`/`payment_allocation_id`,
  y se actualizan `paid_amount` y `payment_status`. Un fallo no descuenta saldo
  ni cambia la factura.
- `paid_amount = 0` deja `pending`; `0 < paid_amount < total` deja `partial`;
  `paid_amount = total` deja `paid`. `balance_due` se calcula como
  `total - paid_amount` y no es una columna.
- Las asignaciones y movimientos son inmutables: no existen endpoints `PUT` ni
  `DELETE`. Tampoco se exponen saldos de billetera en la factura.

### Roles

| Acción                                              | `customer`  | `admin` | `seller` | Otros roles |
| --------------------------------------------------- | ----------- | ------- | -------- | ----------- |
| `POST /invoices/:id/payments`                       | ❌ `403`    | ✅      | ✅       | ❌ `403`    |
| `GET /invoices/:id/payments`                        | Solo propia | ✅      | ✅       | ❌ `403`    |
| Ver `payment_status`, `paid_amount` y `balance_due` | Solo propia | ✅      | ✅       | ❌ `403`    |

Sin token, o con token inválido/expirado, responde `401 Unauthorized`. Un
usuario bloqueado responde `403 User is blocked`. Un `customer` sin
`users.customer_id` responde `403 Customer profile is not linked`. Una factura
de otro cliente responde `404 Invoice not found` para no revelar su existencia.

### `POST /invoices/:id/payments`

Solo `admin` y `seller`. Requiere `payment_id` y `amount`.

```bash
curl -X POST http://localhost:3001/invoices/1/payments \
  -H "Authorization: Bearer <jwt-seller>" \
  -H "Content-Type: application/json" \
  -d '{"payment_id":1,"amount":25}'
```

Respuesta `201`:

```json
{
  "id": 1,
  "payment_id": 1,
  "invoice_id": 1,
  "amount": 25,
  "currency": { "id": 2, "code": "USDT", "name": "Tether", "symbol": "$" },
  "applied_amount": 25,
  "exchange_rate": 1.124,
  "allocated_at": "2026-11-01T13:00:00.000Z",
  "invoice": {
    "id": 1,
    "number": 1,
    "total": 25,
    "paid_amount": 25,
    "balance_due": 0,
    "payment_status": "paid"
  }
}
```

### `GET /invoices/:id/payments`

`admin`, `seller` o el `customer` dueño. Devuelve las asignaciones ordenadas por
`allocated_at` ascendente y luego `id` ascendente. Cada fila incluye el monto y
la moneda del pago, el monto aplicado, la tasa, la fecha, `method_payment` y
`method_payment_type`. `created_by` solo aparece para `admin` y `seller`.

```bash
curl "http://localhost:3001/invoices/1/payments" \
  -H "Authorization: Bearer <jwt-customer>"
```

```json
[
  {
    "id": 1,
    "payment_id": 1,
    "amount": 25,
    "currency": { "id": 2, "code": "USDT", "name": "Tether", "symbol": "$" },
    "applied_amount": 25,
    "exchange_rate": 1.124,
    "allocated_at": "2026-11-01T13:00:00.000Z",
    "method_payment": { "id": 3, "label": "Binance Farmamad" },
    "method_payment_type": { "id": 2, "code": "BINANCE", "name": "Binance" }
  }
]
```

### Factura y filtros actualizados

`GET /invoices/:id` agrega `payments_count` y `payment_history`, un resumen con
`{ payment_id, amount, currency, applied_amount, allocated_at }` sin saldos de
billetera ni el usuario interno. `GET /invoices` ya acepta
`?payment_status=pending|partial|paid`; un valor inválido responde `422`.

```bash
curl "http://localhost:3001/invoices?payment_status=partial" \
  -H "Authorization: Bearer <jwt-seller>"
```

### Errores del módulo

| Código | Situación                                                             | Cuerpo esperado                                                             |
| ------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `400`  | Falta `payment_id` o `amount`                                         | `{ "message": "payment_id and amount are required" }`                       |
| `401`  | Token ausente, inválido o expirado                                    | `{ "message": "Unauthorized" }`                                             |
| `403`  | Rol sin permiso, usuario bloqueado o cliente sin vínculo              | Mensaje específico                                                          |
| `404`  | Factura o pago inexistente                                            | `{ "message": "Invoice not found" }` / `{ "message": "Payment not found" }` |
| `409`  | Factura pagada, asignación duplicada o saldo insuficiente             | Mensaje específico                                                          |
| `422`  | Monto inválido, cliente distinto o monto mayor al saldo de la factura | `{ "errors": { ... } }`                                                     |
| `500`  | Error interno manejado por el handler global                          | `{ "message": "Internal server error" }`                                    |

### Saldo de billetera en pedidos de contado (HU-43/RF-04)

La transición `draft → generate` y `request → generate` calcula
`available = SUM(wallet.balance × walletCurrency.rate ÷ orderCurrency.rate)`
para pedidos de contado (`payment_terms.days = 0`). Si
`available < orders.total`, responde
`409 { "message": "Insufficient wallet balance" }` sin reservar lotes ni
cambiar el estado del pedido. Los pedidos a crédito no validan saldo.

## Tienda (catálogo del cliente) — HU-33

El módulo `store` expone el catálogo que consume un cliente autenticado y la
venta asistida de un vendedor. El precio se resuelve con la lista asignada al
cliente en `customers.price_list_id` usando la fórmula de `src/pricing/`; nunca
se usa `products.sale_price` ni `products.currency_id`. La disponibilidad se
calcula desde `lots` como `SUM(lots.stock - lots.reserved)`; `stocks.quantity`
solo se usa como control (`stocks.quantity = SUM(lots.stock)` en el listado).

Permisos:

| Rol                 | `GET /store/products` | `GET /store/products/:id` |
| ------------------- | --------------------- | ------------------------- |
| `customer`          | ✅ Solo su lista      | ✅ Solo su lista          |
| `admin`             | ✅ Con `customer_id`  | ✅ Con `customer_id`      |
| `seller`            | ✅ Con `customer_id` asignado | ✅ Con `customer_id` asignado |
| `dispatcher`        | ❌ `403`              | ❌ `403`                  |
| `manager_warehouse` | ❌ `403`              | ❌ `403`                  |
| `support`           | ❌ `403`              | ❌ `403`                  |

Sin token o con token inválido/expirado: `401`. Usuario bloqueado: `403` con
`{ "message": "User is blocked" }`.

### `GET /store/products`

Protegido para `customer`, `admin` y `seller`. Un `customer` consulta
automáticamente su propio perfil; un `admin` o `seller` debe enviar
`customer_id`, y el `seller` solo puede consultar clientes asignados en
`customer_sellers`. El filtro opcional `item_state_id` limita el resultado a un
estado vendible; sin filtro se devuelven todos los estados con
`is_sellable = true`.

```bash
curl "http://localhost:3001/store/products?item_state_id=1" \
  -H "Authorization: Bearer <jwt-customer>"
```

Venta asistida:

```bash
curl "http://localhost:3001/store/products?customer_id=8&item_state_id=1" \
  -H "Authorization: Bearer <jwt-seller>"
```

Respuesta `200` (una entrada por producto + estado vendible con precio
resoluble, moneda activa y existencia):

```json
[
  {
    "id": 15,
    "name": "Ibuprofeno 400 mg",
    "description": "Analgésico y antiinflamatorio",
    "reference": "IBU-400",
    "category_id": 2,
    "image_id": 7,
    "item_state": { "id": 1, "name": "sellable", "label": "Vendible" },
    "price": 14.29,
    "currency_id": 3,
    "currency": {
      "id": 3,
      "code": "USD_BCV",
      "name": "Dólar BCV",
      "symbol": "$"
    },
    "available": true,
    "category": { "id": 2, "name": "Analgésicos" },
    "image": {
      "id": 7,
      "url": "https://cdn.example.com/ibuprofeno.png",
      "pathname": null,
      "reference": "ibuprofeno-400",
      "thumbnail": "https://cdn.example.com/ibuprofeno-thumb.png"
    }
  }
]
```

El listado se ordena por `name` ascendente, `id` ascendente y `item_state.id`
ascendente. No incluye variantes agotadas, sin costo para el estado, sin precio
resoluble, con moneda inactiva ni con existencias inconsistentes. Un catálogo
sin variantes responde `200` con `[]`. No expone cantidades, costos, lotes,
bodegas, estantes, secciones, márgenes ni `sale_price`.

### `GET /store/products/:id`

Aplica las mismas reglas de cliente y lista de precios. Devuelve los campos del
producto y un arreglo `variants` con cada estado vendible que tenga costo y
precio resoluble. A diferencia del listado, una variante con precio pero sin
existencia se devuelve con `"available": false`. El parámetro opcional
`item_state_id` limita `variants` a ese estado.

```bash
curl "http://localhost:3001/store/products/15?item_state_id=1" \
  -H "Authorization: Bearer <jwt-customer>"
```

Respuesta `200`:

```json
{
  "id": 15,
  "name": "Ibuprofeno 400 mg",
  "description": "Analgésico y antiinflamatorio",
  "reference": "IBU-400",
  "category_id": 2,
  "image_id": 7,
  "category": { "id": 2, "name": "Analgésicos" },
  "image": {
    "id": 7,
    "url": "https://cdn.example.com/ibuprofeno.png",
    "pathname": null,
    "reference": "ibuprofeno-400",
    "thumbnail": "https://cdn.example.com/ibuprofeno-thumb.png"
  },
  "variants": [
    {
      "item_state": { "id": 1, "name": "sellable", "label": "Vendible" },
      "price": 14.29,
      "currency_id": 3,
      "currency": {
        "id": 3,
        "code": "USD_BCV",
        "name": "Dólar BCV",
        "symbol": "$"
      },
      "available": true
    }
  ]
}
```

Errores del catálogo:

| Código | Situación | Cuerpo esperado |
| ------ | --------- | --------------- |
| `400`  | `admin` o `seller` sin `customer_id` | `{ "message": "customer_id is required" }` |
| `401`  | Token ausente, inválido o expirado | `{ "message": "Unauthorized" }` |
| `403`  | Rol sin permiso o usuario bloqueado | `{ "message": "Forbidden" }` / `{ "message": "User is blocked" }` |
| `403`  | `customer` sin vínculo o sin lista | `{ "message": "Customer profile is not linked" }` / `{ "message": "Customer price list is not assigned" }` |
| `403`  | `seller` no asignado al cliente | `{ "message": "Customer is not assigned to this seller" }` |
| `404`  | Producto inexistente o sin variante con precio | `{ "message": "Product not found" }` |
| `422`  | Id de producto inválido | `{ "errors": { "id": "Invalid product id" } }` |
| `422`  | `item_state_id` inválido o no vendible | `{ "errors": { "item_state_id": "Invalid item state id" } }` / `{ "errors": { "item_state_id": "Invalid item state" } }` |
| `503`  | Sin moneda activa por defecto | `{ "message": "Default transaction currency is not configured" }` |

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
