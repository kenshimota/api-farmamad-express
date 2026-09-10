# API Bread King

REST API de Bread King construida con Express 5, Sequelize 6 y PostgreSQL.

## Puesta en marcha

```bash
npm install
docker-compose up -d db
npm run db:migrate
npx sequelize-cli db:seed:all
npm start
```

La documentación interactiva (Swagger UI) está disponible en
`http://localhost:3000/docs`.

Variables de entorno relevantes: `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USER`, `DB_PASSWORD`, `JWT_SECRET` y `JWT_EXPIRES_IN` (ver `.env.example`).

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
curl http://localhost:3000/hello-world
```

Respuesta `200`:

```json
{ "message": "Hello World" }
```

### `GET /health`

Público. Reporta la salud de la API y de la base de datos.

```bash
curl http://localhost:3000/health
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
curl http://localhost:3000/auth/setup-status
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
curl -X POST http://localhost:3000/auth/register-admin \
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
curl -X POST http://localhost:3000/auth/login \
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
curl http://localhost:3000/auth/me -H "Authorization: Bearer <jwt>"
```

### `POST /users`

Protegido: requiere un JWT con rol `admin`. Crea un usuario con
cualquiera de los roles existentes en la tabla `roles`.

Campos: `username`, `email`, `password` (mínimo 8 caracteres) y `role`
(requeridos); `name` (opcional). Si `username` o `email` ya existen responde
`409`; si el rol no existe responde `422`.

```bash
curl -X POST http://localhost:3000/users \
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

## Tests

```bash
npm test                 # unitarios (sin base de datos)
npm run test:coverage    # unitarios + cobertura
npm run test:integration # contra Postgres real (requiere docker-compose up -d db)
```
