# PhantomBids — Backend

## Qué es

PhantomBids es una plataforma de **subastas inversas secretas** con temática
fantasma: gana la **puja única más baja**, las pujas permanecen ocultas hasta el
cierre, y quien repite un monto recibe una maldición y pierde reputación. Hay
Haunt Houses (casas con miembros y roles), objetos malditos, apuestas paralelas
sobre quién gana y rankings.

Esta API REST reemplaza los datos mock del frontend
(`~/Projects/phantombids`, React + TypeScript). Los nombres de campos se alinean
con `src/types/index.ts` del frontend: camelCase (`minBid`, `maxBid`,
`expiresAt`, `isDuplicate`…) y `id` como string, no `_id`.

Documentos de referencia, en orden de autoridad:

1. `docs/RUBRICA.md` — instrumento de calificación. **Manda sobre cualquier otra
   consideración técnica.**
2. `docs/ESPEC.md` — enunciado del producto (incompleto en reglas de negocio).
3. `docs/REGLAS.md` — reglas de negocio asumidas para cubrir los vacíos.

## Stack (impuesto por la rúbrica, no es una elección de diseño)

- **Node.js ≥ 20 + Express 4 + TypeScript** (ESM, `module: NodeNext`).
- **MongoDB Atlas + Mongoose** — criterio 2 exige schemas con validaciones.
- **JWT (`jsonwebtoken`) + `bcryptjs`** — criterio 4.
- **`express-validator`** — criterio 6 lo nombra explícitamente. No se sustituye
  por Zod, Joi ni validación manual.
- **Swagger UI (`swagger-ui-express` + `swagger-jsdoc`)** — criterio 9, debe
  funcionar también desplegado.
- **Despliegue en Render** — criterio 8 exige URL funcional. Render lee
  `engines.node` del `package.json`.
- Complementos: `helmet`, `cors`, `morgan`, `express-rate-limit`, `dotenv`.
- Calidad: ESLint (`typescript-eslint`), Prettier, Vitest.

### Imports

Se usan **imports relativos con extensión `.js`** (`../services/user.service.js`).
No hay path alias: `@/*` funciona con `tsx` pero `tsc` no reescribe el specifier
y `node dist/index.js` falla con `ERR_MODULE_NOT_FOUND`. No reintroducirlo sin
una solución que funcione en el build.

## Mapa de carpetas

La rúbrica (criterio 1, 10 pts) nombra literalmente `models/`, `services/`,
`controllers/`, `routes/`, `middlewares/`, `utils/`. **No se renombran.**

```
src/
  config/        conexión a MongoDB y variables de entorno tipadas
  models/        schemas de Mongoose, con validaciones (required, minlength, enum…)
  services/      lógica de negocio pura y TODA consulta a Mongoose
  controllers/   handlers HTTP delgados: leen req, llaman al service, responden
  routes/        definición y montaje de rutas + validadores + docs Swagger
  middlewares/   auth (JWT), autorizar (roles), validación, manejo global de errores
  utils/         helpers, AppError, logger, seed.ts (npm run seed)
  types/         tipos compartidos
  app.ts         construcción de la app Express (sin listen)
  index.ts       arranque: conecta a la DB, hace listen, cierre ordenado
```

En la raíz de `src/` solo van `app.ts` e `index.ts`: el criterio 1 penaliza
archivos sueltos.

`src/config/env.ts` valida todas las variables al arrancar y exporta `env`,
tipado e inmutable. **Nunca leer `process.env` fuera de ese archivo.** Para
agregar una variable: validarla en `env.ts`, sumarla a `.env.example`,
`render.yaml` y `docs/DESPLIEGUE.md`.

## Mongoose 9 (no 8)

Diferencias que rompen ejemplos y código copiados de versiones anteriores:

1. **Los hooks `pre()` ya NO reciben `next()`.** Se escriben como funciones
   `async` sin parámetro y se lanza un error para abortar:
   ```ts
   schema.pre('save', async function () {
     if (!this.isModified('password')) return;
     this.password = await bcrypt.hash(this.password, env.BCRYPT_ROUNDS);
   });
   ```
   El patrón `pre('save', function (next) { …; next(); })` está roto.
2. **`create()` e `insertOne()` ya no aceptan parámetros genéricos**: esperan
   `Partial<RawDocType>`. Nada de `Model.create<Algo>(…)`.
3. **La opción `background` en índices fue eliminada.** No usarla en
   `schema.index()` ni en `index: { background: true }`.

## Despliegue

Render, servicio web gratuito, configurado en `render.yaml`. Guía completa y
troubleshooting en `docs/DESPLIEGUE.md`.

- Build: `npm ci --include=dev && npm run build`. El `--include=dev` es
  obligatorio: con `NODE_ENV=production` npm omite las devDependencies y `tsc`
  no existe.
- `GET /health` devuelve 503 si MongoDB está desconectado. Render lo usa como
  health check: no cambiarlo a 200 incondicional.
- `engines.node` es `>=20.19.0` (mínimo de Mongoose 9).

## Regla de capas

**Los controllers NO acceden a los modelos.** Toda consulta a Mongoose
(`find`, `create`, `aggregate`, `save`…) vive en `services/`. Un controller con
`Model.find()` rompe el criterio 1.

Flujo: `routes → middlewares (auth, autorizar, validación) → controller → service → model`.

- El middleware de roles se llama **`autorizar`**, literal (criterio 5).
- Roles globales: `admin` y `user`. Los roles de casa (`head_haunter`,
  `senior_spook`, `spirit`, `poltergeist`) son un eje distinto y no los
  reemplazan. El rol nunca se acepta desde el body del registro.
- Los errores se lanzan como `AppError` y los resuelve el middleware global.

## Convención de respuestas

Éxito:

```json
{ "success": true, "data": { } }
```

Error:

```json
{ "success": false, "error": { "message": "…", "code": "…", "details": [] } }
```

Códigos HTTP correctos siempre (criterio 6): 201 al crear, 400 validación,
401 sin token o token inválido, 403 sin permiso, 404 no encontrado, 409 conflicto.

## Variables de entorno

Todas las claves están en `.env.example` (versionado). `.env` está en
`.gitignore` y nunca se commitea. Ningún secreto ni URL va hardcodeado en el
código: todo se lee desde `src/config/`.

## Flujo de trabajo por sesiones

- Cada sesión trabaja en su rama: `feat/bNN-nombre` (ej. `feat/b02-modelos`).
- Al terminar: commit(s) en la rama, después `git checkout main` y
  `git merge --no-ff feat/bNN-nombre` para conservar la sesión como unidad en
  el historial.
- Antes de cerrar una sesión: `npm run build` y `npm run lint` sin errores.

## Reglas de negocio

**Ninguna decisión de dominio que no esté en `docs/REGLAS.md` se implementa en
silencio.** Si hace falta una regla nueva o distinta, se documenta primero en
`docs/REGLAS.md` y después se implementa. La lógica derivada de REGLAS.md vive
aislada (`auctionResolver.service.ts`, `reputation.service.ts`,
`ranking.service.ts`) para poder reemplazarla cuando la docente entregue las
reglas oficiales. Lo que no esté definido en ninguno de los dos documentos se
marca `TODO(reglas)`.

## Git

**Claude Code nunca ejecuta `git push`.** El push lo hace el autor a mano.
Remoto: `git@github.com:parra0727/phantombids_back.git` (SSH).
