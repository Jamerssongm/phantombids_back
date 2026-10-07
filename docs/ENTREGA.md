# Montar PhantomBids API desde cero

Esta guía es para alguien que **no participó del desarrollo** y no tiene a quién
preguntarle. Sigue los pasos en orden: cada uno dice cómo comprobar que salió
bien y qué hacer si no.

Al final vas a tener la API corriendo en tu máquina, con datos de prueba, y vas a
poder recorrerla desde el navegador.

> Para publicar la API en internet (Render) la guía es otra:
> [`DESPLIEGUE.md`](DESPLIEGUE.md). Esta es solo para tu máquina.

---

## 0. Qué necesitás instalado

| Programa | Versión mínima | Cómo comprobarlo | Dónde conseguirlo |
|---|---|---|---|
| Git | cualquiera reciente | `git --version` | <https://git-scm.com> |
| Node.js | **20.19** | `node -v` | <https://nodejs.org> (versión LTS) |
| npm | viene con Node | `npm -v` | — |
| Docker | cualquiera reciente | `docker --version` | <https://www.docker.com/products/docker-desktop> |

Abrí una terminal y corré los cuatro comandos de la columna "Cómo
comprobarlo". Cada uno tiene que imprimir un número de versión.

**Si falla:**

- *"command not found"* / *"no se reconoce como comando"*: ese programa no está
  instalado, o la terminal se abrió antes de instalarlo. Instalalo, cerrá la
  terminal y abrí una nueva.
- *`node -v` muestra algo menor a `v20.19`* (por ejemplo `v18.x` o `v20.10`):
  instalá la versión LTS actual desde nodejs.org. La base de datos (Mongoose 9)
  no funciona con versiones anteriores.
- *Docker instalado pero `docker ps` da error de conexión* ("Cannot connect to
  the Docker daemon"): Docker Desktop no está abierto. Abrilo y esperá a que diga
  que está corriendo.

---

## 1. Descargar el proyecto

```bash
git clone https://github.com/parra0727/phantombids_back.git
cd phantombids_back
```

**Comprobación:** `ls` (o `dir` en Windows) muestra, entre otros, `package.json`,
`src` y `docs`.

**Si falla:**

- *"Repository not found"* o pide usuario y contraseña: el repositorio es privado.
  Pedí acceso al dueño del repositorio, o usá la copia en `.zip` si te la
  entregaron (descomprimila y entrá a la carpeta con `cd`).
- Si tenés configurada una clave SSH en GitHub, también sirve
  `git clone git@github.com:parra0727/phantombids_back.git`.

---

## 2. Instalar las dependencias

```bash
npm install
```

Tarda uno o dos minutos. **Comprobación:** termina sin la palabra `ERR!` y
aparece una carpeta `node_modules`.

**Si falla:**

- *`EBADENGINE`* o *"Unsupported engine"*: la versión de Node es vieja. Volvé al
  paso 0.
- *Errores de red* (`ETIMEDOUT`, `ECONNRESET`): revisá la conexión y repetí
  `npm install`.
- *Errores de permisos* (`EACCES`) en Linux/macOS: no uses `sudo`. Asegurate de
  estar dentro de tu carpeta de usuario.

---

## 3. Levantar la base de datos (MongoDB en Docker)

```bash
docker run -d --name phantombids-mongo -p 27017:27017 mongo:7
```

La primera vez descarga la imagen (unos cientos de MB). **Comprobación:**

```bash
docker ps
```

tiene que mostrar una fila con `phantombids-mongo` y `0.0.0.0:27017->27017/tcp`.

**Si falla:**

- *`Conflict. The container name "/phantombids-mongo" is already in use`*: ya lo
  creaste antes. Arrancalo con `docker start phantombids-mongo`.
- *`port is already allocated`* / *"address already in use"*: ya hay un MongoDB en
  el puerto 27017 (quizás instalado en tu sistema). Dos opciones:
  - usar ese MongoDB y saltear este paso, o
  - levantar el de Docker en otro puerto:
    `docker run -d --name phantombids-mongo -p 27018:27017 mongo:7` y en el paso
    4 usar `mongodb://localhost:27018/phantombids`.
- *Reiniciaste la computadora y la API no conecta:* el contenedor se detuvo.
  `docker start phantombids-mongo`.

---

## 4. Configurar las variables de entorno

La API lee su configuración de un archivo `.env` que **no viene en el
repositorio** (tiene secretos). Se crea a partir de la plantilla:

```bash
cp .env.example .env          # Linux / macOS / Git Bash
copy .env.example .env        # Windows (cmd o PowerShell)
```

Abrí `.env` con cualquier editor de texto y cambiá **dos** líneas:

1. **`MONGODB_URI`** — dónde está la base. Con el Docker del paso 3:

   ```
   MONGODB_URI=mongodb://localhost:27017/phantombids
   ```

2. **`JWT_SECRET`** — una clave secreta para firmar las sesiones. Tiene que tener
   al menos 32 caracteres. Generá una con:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   y pegá el resultado:

   ```
   JWT_SECRET=pegá-acá-lo-que-imprimió-el-comando
   ```

El resto de las líneas puede quedar como está. Qué significa cada una está en la
tabla de variables del [`README.md`](../README.md#variables-de-entorno).

**Comprobación:** se hace en el paso siguiente. Si algo está mal, la API lo dice
al arrancar.

---

## 5. Cargar datos de prueba

```bash
npm run seed
```

**Comprobación:** termina con `🌱 Seed completado`, una tabla con la cantidad de
documentos por colección (9 usuarios, 4 casas, 8 maldiciones, 7 subastas…) y las
credenciales del administrador.

Podés correrlo las veces que quieras: borra todo y vuelve a cargar lo mismo.

**Si falla:**

- *`❌ Configuración inválida`* seguido de una lista: la lista dice exactamente
  qué variable del `.env` falta o está mal. Corregila (paso 4) y repetí.
- *`No se pudo conectar a MongoDB … ECONNREFUSED`*: la base no está corriendo.
  Volvé al paso 3 (`docker ps`, `docker start phantombids-mongo`) y revisá que el
  puerto de `MONGODB_URI` coincida con el del contenedor.
- *`NODE_ENV=production: el seed BORRA todas las colecciones`*: en tu `.env`
  quedó `NODE_ENV=production`. Cambialo a `development`.

---

## 6. Arrancar la API

```bash
npm run dev
```

**Comprobación:** la terminal muestra

```
… INFO  MongoDB conectado (base: phantombids)
… INFO  Scheduler de subastas activo (cada 60 s)
… INFO  PhantomBids API escuchando en el puerto 3000 (development)
```

Dejá esa terminal abierta: la API corre mientras esté abierta. Para detenerla,
`Ctrl + C`.

**Si falla:**

- *`No se pudo levantar el servidor: el puerto 3000 ya está en uso`*: otro
  programa usa el puerto 3000. En `.env` cambiá `PORT=3000` por otro número (por
  ejemplo `PORT=3001`) y usá ese número en las direcciones de abajo.
- Los mismos errores de configuración o conexión del paso 5 se resuelven igual.

---

## 7. Verificar que funciona

Con la API corriendo, abrí estas direcciones en el navegador:

| Dirección | Qué tenés que ver |
|---|---|
| <http://localhost:3000/health> | `"status":"ok"` y `"db":"connected"` |
| <http://localhost:3000/> | `"name":"PhantomBids API"` |
| <http://localhost:3000/api/docs> | **Swagger UI**: la documentación interactiva, con todos los endpoints agrupados |

### Probar un endpoint protegido desde Swagger UI

1. En <http://localhost:3000/api/docs>, abrí **Auth → POST /api/auth/login**.
2. **Try it out**, dejá el cuerpo de ejemplo (`admin@phantombids.dev` /
   `Admin123!`) y **Execute**.
3. En la respuesta, copiá el valor de `"token"` (sin las comillas).
4. Arriba a la derecha, **Authorize**, pegá el token y **Authorize**.
5. Probá **Users → GET /api/users**: tiene que devolver la lista de usuarios.

Si preferís recorrer toda la API en orden sin escribir nada, importá en Postman
la colección [`PhantomBids.postman_collection.json`](PhantomBids.postman_collection.json)
(**Import** → elegir el archivo) y ejecutala con **Run collection**. La variable
`baseUrl` ya apunta a `http://localhost:3000`.

### Tests

En otra terminal, dentro de la carpeta del proyecto:

```bash
npm test
```

Tiene que terminar con `Tests  14 passed`.

**Si falla:**

- *`/health` responde `"db":"disconnected"`* (código 503): la API arrancó pero
  perdió la base. `docker start phantombids-mongo` y recargá.
- *El navegador dice "no se puede acceder al sitio"*: la API no está corriendo
  (paso 6) o usaste otro `PORT`.
- *Login responde 401 "Credenciales inválidas"*: no corriste el seed (paso 5), o
  corriste el seed contra otra base distinta de la que usa la API.
- *Respuesta 429 "Demasiados intentos"*: fallaste el login 10 veces en 15
  minutos. Reiniciá la API (`Ctrl + C` y `npm run dev`) para limpiar el contador.

---

## Usuarios de prueba

| Rol | Email | Contraseña |
|---|---|---|
| admin | `admin@phantombids.dev` | `Admin123!` |
| user | `sombrio@phantombids.dev` (head_haunter de Casa Oscuridad) | `Phantom123!` |
| user | `errante@`, `nebuloso@`, `umbral@`, `gelido@`, `silente@`, `nocturno@`, `fantasmal@` + `phantombids.dev` | `Phantom123!` |

---

## Apagar y limpiar

```bash
# detener la API: Ctrl + C en su terminal
docker stop phantombids-mongo        # detener la base (los datos se conservan)
docker rm phantombids-mongo          # borrarla del todo (se pierden los datos)
```

---

## Después de desplegar en Render: último paso

Cuando la API ya esté publicada en Render siguiendo
[`DESPLIEGUE.md`](DESPLIEGUE.md), queda **un último paso**: poner la URL real en
el README.

1. Abrí `README.md`. Arriba de todo, en la sección **API en producción**, hay un
   comentario `<!-- URL_RENDER: reemplazar al desplegar … -->` y tres apariciones
   de `URL_RENDER`.
2. Reemplazá las tres por la URL del servicio (por ejemplo
   `https://phantombids-api.onrender.com`, sin `/` al final) y borrá el
   comentario.
3. Comprobá que no quedó ninguna: buscá `URL_RENDER` en el archivo (no tiene que
   aparecer).
4. En la colección de Postman, cambiá la variable `baseUrl` por esa misma URL
   para recorrer la API desplegada.
