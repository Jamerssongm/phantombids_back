# Despliegue en Render

Criterio 8 de la rúbrica (10 pts): **API desplegada, URL funcional, variables
configuradas.** Esta guía cubre el despliegue manual desde el dashboard. El
archivo `render.yaml` de la raíz describe la misma configuración como Blueprint.

---

## 0. Antes de empezar: MongoDB Atlas

1. En Atlas → **Network Access** → **Add IP Address** → **Allow access from
   anywhere** (`0.0.0.0/0`). Render no tiene IP estática en el tier gratuito, así
   que no hay otra IP que se pueda autorizar.
2. En Atlas → **Database Access**, confirmar que existe un usuario con permiso de
   lectura y escritura sobre la base.
3. En Atlas → **Connect** → **Drivers**, copiar la cadena `mongodb+srv://…`,
   reemplazar `<password>` y agregar el nombre de la base antes del `?`:

   ```
   mongodb+srv://usuario:password@cluster0.xxxxx.mongodb.net/phantombids?retryWrites=true&w=majority
   ```

   Si la contraseña tiene caracteres especiales (`@`, `:`, `/`, `#`, `%`), hay
   que codificarlos en la URL (por ejemplo, `@` pasa a ser `%40`).

## 1. Crear el servicio

1. Entrar a <https://dashboard.render.com> → **New** → **Web Service**.
2. **Connect a repository** → autorizar GitHub → elegir
   `parra0727/phantombids_back`.
3. Completar:

   | Campo | Valor |
   |---|---|
   | Name | `phantombids-api` |
   | Region | Oregon (o la más cercana) |
   | Branch | `main` |
   | Root Directory | *(vacío)* |
   | Runtime / Language | `Node` |
   | Build Command | `npm ci --include=dev && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | `Free` |

   El `--include=dev` **no es opcional**. Ver el troubleshooting más abajo.

4. **Advanced** → **Health Check Path**: `/health`.
5. **Advanced** → **Auto-Deploy**: `Yes` (despliega en cada push a `main`).

La versión de Node la elige Render a partir de `engines.node` en `package.json`
(`>=20.19.0`, que es lo que exige Mongoose 9).

## 2. Variables de entorno

En **Environment** → **Add Environment Variable**, cargar una por una:

| Clave | Valor | Notas |
|---|---|---|
| `NODE_ENV` | `production` | Desactiva morgan y activa el modo producción |
| `MONGODB_URI` | la cadena de Atlas del paso 0 | Secreto |
| `JWT_SECRET` | un string aleatorio de 32 caracteres o más | Secreto. Generarlo con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. **No reutilizar el del `.env` local** |
| `JWT_EXPIRES_IN` | `1d` | |
| `BCRYPT_ROUNDS` | `10` | |
| `CORS_ORIGIN` | URL del frontend desplegado, ej. `https://phantombids.vercel.app` | Varias separadas por coma, sin `/` al final |
| `AUTO_CLOSE_ENABLED` | `true` | **Siempre `true`.** Activa el cierre automático de subastas; se recupera solo cuando el servicio despierta (ver Limitaciones) |

**No cargar `PORT`.** Render lo inyecta solo (10000) y la app lo lee de ahí.

Guardar con **Save Changes**. Esto dispara un deploy.

## 3. Verificar

1. En **Logs** tienen que aparecer, en orden:

   ```
   …Z INFO  MongoDB conectado (base: phantombids)
   …Z INFO  Scheduler de subastas activo (cada 60 s)
   …Z INFO  PhantomBids API escuchando en el puerto 10000 (production)
   ```

   y el deploy tiene que quedar en **Live**.

2. Desde una terminal (reemplazar la URL por la del servicio):

   ```bash
   curl -i https://phantombids-api.onrender.com/health
   # HTTP/2 200
   # {"status":"ok","uptime":…,"db":"connected","timestamp":"…","environment":"production"}

   curl -i https://phantombids-api.onrender.com/
   # HTTP/2 200 con nombre, versión y enlace a /api/docs

   curl -i https://phantombids-api.onrender.com/no-existe
   # HTTP/2 404 con {"success":false,"error":{…,"code":"NOT_FOUND"}}

   curl -s https://phantombids-api.onrender.com/api/docs.json | head -c 200
   # la especificación OpenAPI; abrir /api/docs en el navegador para Swagger UI
   ```

3. Comprobar que `"environment"` diga `production` y `"db"` diga `connected`.

---

## Limitaciones conocidas del tier gratuito

### El servicio se duerme

A los **15 minutos sin tráfico**, Render apaga la instancia. La primera petición
siguiente la despierta y tarda **alrededor de un minuto** en responder. Las
siguientes son normales.

- **Antes de la sustentación o de mostrar la API**, abrir `/health` un par de
  minutos antes para despertarla.
- El frontend debería mostrar un estado de carga razonable en la primera
  petición, no un error por timeout corto.

**El cierre automático de subastas NO se pierde por esto** (por eso
`AUTO_CLOSE_ENABLED=true`): al arrancar, el scheduler hace una pasada inmediata
que cierra y liquida toda subasta cuyo `closesAt` venció mientras el proceso
estaba dormido; además, cualquier acceso a una subasta vencida la cierra en ese
momento. El resultado es el mismo que si se hubiera cerrado a la hora exacta,
porque las pujas posteriores a `closesAt` se rechazan siempre.

### Atlas abierto a 0.0.0.0/0

Render no da IP estática en el tier gratuito, así que Atlas tiene que aceptar
conexiones desde cualquier IP. La protección real pasa a ser el usuario y la
contraseña de la cadena de conexión: tienen que ser fuertes y no pueden aparecer
en el repositorio.

---

## Troubleshooting

### El build falla con `tsc: not found` o `Cannot find module 'typescript'`

**Causa:** con `NODE_ENV=production`, `npm ci` omite las `devDependencies` y
TypeScript no se instala.

**Solución:** el Build Command tiene que ser exactamente
`npm ci --include=dev && npm run build`. Revisarlo en **Settings** → **Build &
Deploy**, corregirlo y hacer **Manual Deploy** → **Deploy latest commit**.

### `ERROR No se pudo conectar a MongoDB: … Server selection timed out` o `bad auth`

- **`Server selection timed out` / `Could not connect to any servers`:** Atlas
  rechaza la IP de Render. Agregar `0.0.0.0/0` en **Network Access** y esperar a
  que figure como *Active* (puede tardar 1–2 minutos). Después, **Manual Deploy**.
- **`bad auth : authentication failed`:** usuario o contraseña incorrectos en
  `MONGODB_URI`, o la contraseña tiene caracteres especiales sin codificar.
  Verificar en **Database Access** y volver a pegar la cadena.
- **`querySrv ENOTFOUND`:** el host del cluster está mal copiado. Volver a copiar
  la cadena desde **Connect** en Atlas.

### `❌ Configuración inválida. Revisá las variables de entorno`

La app valida las variables al arrancar y termina el proceso si falta una o
tiene formato inválido. El log dice exactamente cuál, por ejemplo:

```
❌ Configuración inválida. Revisá las variables de entorno (ver .env.example):
   - JWT_SECRET es obligatoria y no está definida
```

Cargarla en **Environment**. Guardar redespliega automáticamente.

### El deploy queda en "Deploy failed" por health check

`/health` devuelve **503** mientras MongoDB no está conectado, y Render no marca
el servicio como sano. Casi siempre es un problema de conexión a Atlas: ver la
sección de MongoDB de arriba.

### El frontend recibe errores de CORS

`CORS_ORIGIN` tiene que coincidir **exactamente** con el origen del frontend:
protocolo incluido y sin `/` final (`https://app.vercel.app`, no
`https://app.vercel.app/`).
