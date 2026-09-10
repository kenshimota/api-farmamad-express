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

Respuesta `409`:

```json
{ "message": "Admin already exists" }
```

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

| Código | Cuerpo                                                   |
| ------ | -------------------------------------------------------- |
| `400`  | `{ "message": "email, password and role are required" }` |
| `401`  | `{ "message": "Unauthorized" }`                          |
| `403`  | `{ "message": "Forbidden" }`                             |
| `409`  | `{ "message": "User already exists" }`                   |
| `422`  | `{ "errors": { "role": "Invalid role" } }`               |

En ningún caso la contraseña viaja en las respuestas: se guarda como hash
bcrypt.

## Tests

```bash
npm test                 # unitarios (sin base de datos)
npm run test:coverage    # unitarios + cobertura
npm run test:integration # contra Postgres real (requiere docker-compose up -d db)
```

## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

- [Create](https://docs.gitlab.com/user/project/repository/web_editor/#create-a-file) or [upload](https://docs.gitlab.com/user/project/repository/web_editor/#upload-a-file) files
- [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://gitlab.com/kenshimota/api-bread-king.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

- [Set up project integrations](https://gitlab.com/kenshimota/api-bread-king/-/settings/integrations)

## Collaborate with your team

- [Invite team members and collaborators](https://docs.gitlab.com/user/project/members/)
- [Create a new merge request](https://docs.gitlab.com/user/project/merge_requests/creating_merge_requests/)
- [Automatically close issues from merge requests](https://docs.gitlab.com/user/project/issues/managing_issues/#closing-issues-automatically)
- [Enable merge request approvals](https://docs.gitlab.com/user/project/merge_requests/approvals/)
- [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

- [Get started with GitLab CI/CD](https://docs.gitlab.com/ci/quick_start/)
- [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/user/application_security/sast/)
- [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/topics/autodevops/requirements/)
- [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/user/clusters/agent/)
- [Set up protected environments](https://docs.gitlab.com/ci/environments/protected_environments/)

---

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name

Choose a self-explaining name for your project.

## Description

Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges

On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals

Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation

Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage

Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support

Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap

If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing

State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment

Show your appreciation to those who have contributed to the project.

## License

For open source projects, say how it is licensed.

## Project status

If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
