# Montar PhantomBids API desde cero

Esta guía es para alguien que **no participó del desarrollo** y no tiene a quién
preguntarle. Está pensada para **Windows 11**, y cada comando aparece en dos
versiones:

- **PowerShell**: la terminal de Windows. Es la que vas a usar en Windows 11
  (menú Inicio → escribí `PowerShell` → **Windows PowerShell** o **Terminal**).
- **bash**: para Linux, macOS o Git Bash. Si estás en Windows, ignorá esos
  bloques.

Seguí los pasos en orden. Cada uno dice cómo comprobar que salió bien; si algo
falla, buscá el mensaje en [Solución de problemas](#solución-de-problemas) al
final.

Al terminar vas a tener la API corriendo en tu máquina, con datos de prueba, y
vas a poder recorrerla desde el navegador.

> Para publicar la API en internet (Render) la guía es otra:
> [`DESPLIEGUE.md`](DESPLIEGUE.md). Esta es para tu máquina, pero el **camino A**
> de abajo te deja lista la base de datos que Render también necesita.

---

## 0. Programas necesarios

| Programa | Versión mínima | Dónde conseguirlo |
|---|---|---|
| Git | cualquiera reciente | <https://git-scm.com/download/win> |
| Node.js | **20.19** (recomendado: la LTS actual) | <https://nodejs.org> → botón **LTS** |
| npm | viene con Node | — |

Para instalarlos también podés usar `winget` desde PowerShell:

**PowerShell**
```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
```

**bash** (Linux con apt; en macOS usá Homebrew o los instaladores de las webs)
```bash
sudo apt install git
# Node: usar el instalador de nodejs.org o nvm; la versión de apt suele ser vieja
```

Después de instalar, **cerrá la terminal y abrí una nueva**, y comprobá las
versiones:

**PowerShell**
```powershell
git --version
node -v
npm -v
```

**bash**
```bash
git --version
node -v
npm -v
```

Los tres tienen que imprimir un número. `node -v` tiene que ser **v20.19.0 o
mayor** (por ejemplo `v22.12.0` o `v24.15.0`). Si muestra algo menor, ver
[Node con versión menor a 20.19](#node-con-versión-menor-a-2019).

---

## 1. Descargar el proyecto

**PowerShell**
```powershell
cd $HOME\Documents
git clone https://github.com/parra0727/phantombids_back.git
cd phantombids_back
```

**bash**
```bash
cd ~
git clone https://github.com/parra0727/phantombids_back.git
cd phantombids_back
```

**Comprobación:** `dir` (PowerShell) o `ls` (bash) muestra, entre otros,
`package.json`, `src` y `docs`.

Si pide usuario y contraseña o dice *"Repository not found"*, el repositorio es
privado: pedí acceso al dueño, o usá la copia `.zip` si te la entregaron
(descomprimila y entrá a la carpeta con `cd`).

> **Importante:** todos los comandos que siguen se ejecutan **dentro de la
> carpeta `phantombids_back`**.

---

## 2. Instalar las dependencias

**PowerShell**
```powershell
npm install
```

**bash**
```bash
npm install
```

Tarda uno o dos minutos. **Comprobación:** termina sin la palabra `ERR!` y aparece
una carpeta `node_modules`.

Si en PowerShell aparece *"la ejecución de scripts está deshabilitada en este
sistema"*, ver [npm bloqueado en PowerShell](#npm-bloqueado-en-powershell).

---

## 3. La base de datos: elegí un camino

La API necesita un servidor MongoDB. Hay dos formas de tenerlo:

| | Camino A — MongoDB Atlas (**recomendado**) | Camino B — Docker Desktop |
|---|---|---|
| Qué es | Una base en la nube, gratis | Un MongoDB que corre en tu PC |
| Qué instalás | Nada | Docker Desktop + WSL2 |
| Internet | Necesario | No hace falta (una vez descargada la imagen) |
| Sirve para Render | **Sí**: es el mismo cluster | No |

**Si vas a desplegar en Render, elegí el camino A.** Render necesita un cluster
de Atlas igual, así que usar ese mismo cluster en tu máquina te evita instalar
Docker Desktop y WSL2.

Seguí **solo uno** de los dos: [A](#camino-a-mongodb-atlas-recomendado) o
[B](#camino-b-docker-desktop-en-windows).

---

## Camino A: MongoDB Atlas (recomendado)

### A.1 Crear la cuenta y el cluster gratuito

1. Entrá a <https://www.mongodb.com/cloud/atlas/register> y creá una cuenta
   (sirve la de Google).
2. Cuando te ofrezca crear un cluster (**Create a cluster** o **Build a
   Database**), elegí el plan **M0 / Free**. Proveedor y región: cualquiera; la
   más cercana a vos es la mejor. Dejá el nombre `Cluster0`.
3. **Create Deployment**. Tarda uno o dos minutos.

### A.2 Crear el usuario de la base

Atlas te muestra una pantalla **Connect to Cluster0** / **Security Quickstart**.
Si no aparece: menú izquierdo → **Database Access** → **Add New Database User**.

1. **Username:** por ejemplo `phantom`.
2. **Password:** tocá **Autogenerate Secure Password** y **copiala en un lugar
   seguro**. No la vas a poder volver a ver.
3. Rol: **Read and write to any database**.
4. **Create User**.

> ⚠️ **Contraseñas con `@` `:` `/` `#` `?` `%` rompen la cadena de conexión.**
> Esos caracteres tienen significado dentro de la cadena: un `@` en la contraseña,
> por ejemplo, hace que Mongo crea que ahí termina el usuario. La contraseña
> autogenerada de Atlas usa solo letras y números, así que no tiene el problema.
> Si elegiste una propia con esos caracteres, cambiala por una de solo letras y
> números (**Database Access** → **Edit** → **Edit Password**), o reemplazá cada
> carácter por su código: `@` → `%40`, `:` → `%3A`, `/` → `%2F`, `#` → `%23`,
> `?` → `%3F`, `%` → `%25`.

### A.3 Permitir el acceso de red

Menú izquierdo → **Network Access** → **Add IP Address** → **Allow access from
anywhere** (queda `0.0.0.0/0`) → **Confirm**. Esperá a que el estado diga
**Active** (uno o dos minutos).

Hace falta `0.0.0.0/0` y no solo tu IP porque **Render no tiene una IP fija** en
el plan gratuito; así la misma configuración sirve para tu máquina y para el
despliegue. La protección pasa a ser el usuario y la contraseña.

### A.4 Copiar la cadena de conexión

Menú izquierdo → **Database** (o **Clusters**) → **Connect** → **Drivers**.
Copiá la cadena que aparece. Se ve así:

```
mongodb+srv://phantom:<db_password>@cluster0.ab1cd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
```

### A.5 Dos bases en el mismo cluster: una para tu máquina, otra para Render

Un mismo cluster puede tener varias bases. Se usan **dos**:

| Base | Para qué |
|---|---|
| `phantombids_dev` | Tu máquina. Acá corrés el seed y probás lo que quieras |
| `phantombids` | El despliegue en Render. Tus pruebas locales no la tocan |

**El nombre de la base va en la cadena de conexión, entre `.net/` y el `?`.**
Partiendo de la cadena del paso A.4, con la contraseña real en lugar de
`<db_password>` (por ejemplo `Xy7kQ2pLm9`):

Para **tu máquina** (va en tu `.env`, paso 4):
```
mongodb+srv://phantom:Xy7kQ2pLm9@cluster0.ab1cd.mongodb.net/phantombids_dev?retryWrites=true&w=majority&appName=Cluster0
```

Para **Render** (va en las variables de Render, ver `DESPLIEGUE.md`):
```
mongodb+srv://phantom:Xy7kQ2pLm9@cluster0.ab1cd.mongodb.net/phantombids?retryWrites=true&w=majority&appName=Cluster0
```

La única diferencia es lo que está entre `.net/` y `?`.

> ⚠️ **El error más común: olvidar el nombre de la base.** Si la cadena queda
> `….mongodb.net/?retryWrites…` (sin nada entre `/` y `?`), Mongo no da error:
> escribe todo en una base llamada **`test`**. El seed "funciona", pero después
> la API (o Render) busca en otra base y no encuentra nada. Revisá siempre que
> antes del `?` diga `phantombids_dev` (en tu máquina) o `phantombids` (en
> Render).

> ⚠️ **Nunca pongas la base `phantombids` en tu `.env` local.** `npm run seed`
> **borra todas las colecciones** de la base a la que apunta. Con la cadena de
> Render en tu `.env`, borrarías los datos del despliegue.

Seguí en el [paso 4](#4-configurar-el-archivo-env).

---

## Camino B: Docker Desktop en Windows

Para trabajar sin conexión a internet. Requiere **Docker Desktop con el motor
WSL2** (el subsistema de Linux de Windows).

### B.1 Instalar WSL2 y Docker Desktop

1. Abrí PowerShell **como administrador** (clic derecho en el ícono →
   **Ejecutar como administrador**) y ejecutá:

   **PowerShell (administrador) — solo Windows, no tiene equivalente en bash**
   ```powershell
   wsl --install
   ```

   Reiniciá la computadora cuando lo pida.

2. Descargá e instalá Docker Desktop:
   <https://www.docker.com/products/docker-desktop>. En el instalador dejá
   marcada la opción **Use WSL 2 instead of Hyper-V**.
3. Abrí **Docker Desktop** y esperá a que abajo a la izquierda diga **Engine
   running** (en verde).
4. Comprobá en **Settings → General** que esté marcado **Use the WSL 2 based
   engine**.

En Linux (bash), en vez de Docker Desktop alcanza con Docker Engine:
<https://docs.docker.com/engine/install/>.

### B.2 Levantar MongoDB

El comando va **en una sola línea**. La barra invertida `\` que se usa en bash
para partir comandos largos **no funciona en PowerShell**.

**PowerShell**
```powershell
docker run -d --name phantombids-mongo -p 27017:27017 mongo:8.2
```

**bash**
```bash
docker run -d --name phantombids-mongo -p 27017:27017 mongo:8.2
```

> Usá **`mongo:8.2`**, no `mongo:8` ni `mongo:latest`: las versiones más nuevas
> no arrancan en kernels Linux 6.19 o posteriores (ver
> [El error de kernel de MongoDB](#mongodb-cannot-start-linux-kernel-versions-619-and-newer)).

La primera vez descarga la imagen (unos cientos de MB). **Comprobación:**

**PowerShell**
```powershell
docker ps
```

**bash**
```bash
docker ps
```

Tiene que aparecer una fila con `phantombids-mongo` y `0.0.0.0:27017->27017/tcp`.

Con este camino, la cadena de conexión para el `.env` es:

```
mongodb://localhost:27017/phantombids
```

> Si reiniciás la computadora, el contenedor queda detenido. Antes de trabajar:
> abrí Docker Desktop y ejecutá `docker start phantombids-mongo` (igual en
> PowerShell y en bash).

---

## 4. Configurar el archivo `.env`

La API lee su configuración de un archivo `.env` que **no viene en el
repositorio** (tiene secretos). Se crea copiando la plantilla:

**PowerShell**
```powershell
Copy-Item .env.example .env
notepad .env
```

**bash**
```bash
cp .env.example .env
nano .env
```

En el editor, cambiá **dos** líneas:

**1. `MONGODB_URI`**: la cadena de tu camino.

- Camino A (Atlas), la de **`phantombids_dev`** del paso A.5:
  ```
  MONGODB_URI=mongodb+srv://phantom:Xy7kQ2pLm9@cluster0.ab1cd.mongodb.net/phantombids_dev?retryWrites=true&w=majority&appName=Cluster0
  ```
- Camino B (Docker):
  ```
  MONGODB_URI=mongodb://localhost:27017/phantombids
  ```

Sin comillas y sin espacios alrededor del `=`.

**2. `JWT_SECRET`**: una clave secreta de al menos 32 caracteres. Generala con
este comando (en otra terminal, o cerrando el editor un momento):

**PowerShell**
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**bash**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

y pegá el resultado:

```
JWT_SECRET=pegá-acá-lo-que-imprimió-el-comando
```

Guardá el archivo (Bloc de notas: **Ctrl + S**; nano: **Ctrl + O**, Enter,
**Ctrl + X**). El resto de las líneas puede quedar como está. Qué significa cada
una está en la tabla de variables del
[`README.md`](../README.md#variables-de-entorno).

> **El archivo tiene que llamarse exactamente `.env`**, no `.env.txt`. Si lo
> creaste desde el Explorador de Windows, puede haber quedado con `.txt` oculto.
> Comprobalo con `dir -Force .env*` (PowerShell) o `ls -a .env*` (bash): tienen
> que aparecer `.env` y `.env.example`, nada más.

---

## 5. Cargar datos de prueba

**PowerShell**
```powershell
npm run seed
```

**bash**
```bash
npm run seed
```

**Comprobación:** termina con `🌱 Seed completado`, una tabla con la cantidad de
documentos por colección (9 usuarios, 4 casas, 8 maldiciones, 7 subastas…) y las
credenciales del administrador.

Podés correrlo las veces que quieras: borra todo y vuelve a cargar lo mismo
**en la base de tu `.env`**. Por eso esa base tiene que ser `phantombids_dev`
(camino A) o la de Docker (camino B), nunca la de Render.

---

## 6. Arrancar la API

**PowerShell**
```powershell
npm run dev
```

**bash**
```bash
npm run dev
```

**Comprobación:** la terminal muestra

```
… INFO  MongoDB conectado (base: phantombids_dev)
… INFO  Scheduler de subastas activo (cada 60 s)
… INFO  PhantomBids API escuchando en el puerto 3000 (development)
```

El nombre de la base es `phantombids_dev` en el camino A o `phantombids` en el
B. **Si dice `test`, falta el nombre de la base en `MONGODB_URI`**: volvé al
paso A.5.

Dejá esa terminal abierta: la API corre mientras esté abierta. Para detenerla,
**Ctrl + C**.

---

## 7. Verificar que funciona

Con la API corriendo, abrí estas direcciones en el navegador:

| Dirección | Qué tenés que ver |
|---|---|
| <http://localhost:3000/health> | `"status":"ok"` y `"db":"connected"` |
| <http://localhost:3000/> | `"name":"PhantomBids API"` |
| <http://localhost:3000/api/docs> | **Swagger UI**: la documentación interactiva, con todos los endpoints agrupados |

O desde una **segunda** terminal:

**PowerShell**
```powershell
Invoke-RestMethod http://localhost:3000/health
```

**bash**
```bash
curl -s http://localhost:3000/health
```

### Probar un endpoint protegido desde Swagger UI

1. En <http://localhost:3000/api/docs>, abrí **Auth → POST /api/auth/login**.
2. **Try it out**, dejá el cuerpo de ejemplo (`admin@phantombids.dev` /
   `Admin123!`) y **Execute**.
3. En la respuesta, copiá el valor de `"token"` (sin las comillas).
4. Arriba a la derecha, **Authorize**, pegá el token y **Authorize**.
5. Probá **Users → GET /api/users**: tiene que devolver la lista de usuarios.

### Recorrer toda la API con Postman

Importá en Postman la colección
[`PhantomBids.postman_collection.json`](PhantomBids.postman_collection.json)
(**Import** → elegir el archivo) y ejecutala con **Run collection**. La variable
`baseUrl` ya apunta a `http://localhost:3000`. Los 79 requests tienen que pasar.

### Tests

En la segunda terminal, dentro de la carpeta del proyecto:

**PowerShell**
```powershell
npm test
```

**bash**
```bash
npm test
```

Tiene que terminar con `Tests  14 passed`.

---

## Usuarios de prueba

| Rol | Email | Contraseña |
|---|---|---|
| admin | `admin@phantombids.dev` | `Admin123!` |
| user | `sombrio@phantombids.dev` (head_haunter de Casa Oscuridad) | `Phantom123!` |
| user | `errante@`, `nebuloso@`, `umbral@`, `gelido@`, `silente@`, `nocturno@`, `fantasmal@` + `phantombids.dev` | `Phantom123!` |

---

## Apagar y limpiar

Para detener la API: **Ctrl + C** en su terminal.

Solo camino B (Docker):

**PowerShell**
```powershell
docker stop phantombids-mongo
docker rm phantombids-mongo
```

**bash**
```bash
docker stop phantombids-mongo
docker rm phantombids-mongo
```

`docker stop` la detiene y conserva los datos; `docker rm` la borra del todo.

---

## Solución de problemas

### `ECONNREFUSED 127.0.0.1:27017`

Mensaje completo: `No se pudo conectar a MongoDB: connect ECONNREFUSED
127.0.0.1:27017`.

**Qué significa:** la API intentó conectarse a un MongoDB **en tu propia
máquina** (`127.0.0.1` es "esta computadora", `27017` el puerto de MongoDB) y no
había nada escuchando ahí.

**Si elegiste el camino A (Atlas):** ese error **no debería aparecer**, porque tu
cadena apunta a `mongodb.net`, no a tu máquina. Que aparezca quiere decir que la
API no está leyendo tu cadena de Atlas. Revisá:

1. Que en `.env` la línea `MONGODB_URI=` tenga la cadena `mongodb+srv://…` y no
   la de ejemplo con `localhost`.
2. Que guardaste el archivo.
3. Que el archivo se llama `.env` y no `.env.txt` (ver el final del paso 4).
4. Que estás ejecutando los comandos dentro de la carpeta `phantombids_back`.

**Si elegiste el camino B (Docker):** el contenedor no está corriendo.

1. ¿Docker Desktop está abierto y dice **Engine running**?
2. `docker ps`: ¿aparece `phantombids-mongo`? Si no, `docker start
   phantombids-mongo`. Si dice que no existe, creala con el comando del paso B.2.
3. Si `docker ps -a` lo muestra con estado `Exited`, mirá por qué con
   `docker logs phantombids-mongo`. Si aparece el mensaje del kernel, ver el
   punto siguiente.

### `MongoDB cannot start: Linux kernel versions 6.19 and newer…`

Mensaje textual, en `docker logs phantombids-mongo`:

```
MongoDB cannot start: Linux kernel versions 6.19 and newer has a known incompatibility with this version of MongoDB
```

**La causa es el kernel de Linux, no este proyecto.** Las versiones recientes de
MongoDB (por ejemplo la que hoy trae la etiqueta `mongo:8`) tienen una
incompatibilidad conocida con los kernels 6.19 o posteriores (MongoDB
SERVER-121912) y se niegan a arrancar. Un contenedor usa el kernel del sistema
que lo corre: en Linux, el de tu distribución; en Windows, el de WSL2.

**Solución:** usar la imagen **`mongo:8.2`**, que sí funciona:

**PowerShell**
```powershell
docker rm phantombids-mongo
docker run -d --name phantombids-mongo -p 27017:27017 mongo:8.2
```

**bash**
```bash
docker rm phantombids-mongo
docker run -d --name phantombids-mongo -p 27017:27017 mongo:8.2
```

O pasarte al camino A (Atlas), donde esto no aplica.

### Docker Desktop sin WSL2

Mensajes típicos: *"WSL 2 installation is incomplete"*, *"Docker Desktop requires
WSL 2"*, *"Docker Desktop is unable to start"*, o Docker Desktop que se queda en
**Starting** para siempre.

1. En PowerShell **como administrador**:

   **PowerShell (administrador) — solo Windows, no tiene equivalente en bash**
   ```powershell
   wsl --status
   wsl --install
   wsl --update
   ```

   Reiniciá la computadora.
2. En Docker Desktop: **Settings → General → Use the WSL 2 based engine**
   marcado → **Apply & restart**.
3. Si `wsl --install` dice que **la virtualización no está habilitada**, hay que
   activarla en la BIOS/UEFI de la computadora (la opción se llama Intel VT-x,
   Intel Virtualization Technology, AMD-V o SVM según el fabricante). Si no
   podés, usá el camino A.

(En Linux no hay WSL: si `docker ps` dice *"Cannot connect to the Docker
daemon"*, el servicio no está corriendo: `sudo systemctl start docker`.)

### Puerto 27017 ocupado

Mensaje al crear el contenedor: *"port is already allocated"* o *"Bind for
0.0.0.0:27017 failed"*.

Otro programa ya usa el puerto 27017. Lo más común en Windows es un **MongoDB
instalado como servicio** desde el instalador oficial. Averiguá qué es:

**PowerShell**
```powershell
Get-NetTCPConnection -LocalPort 27017 -State Listen | Select-Object OwningProcess
Get-Service *mongo*
```

**bash**
```bash
sudo ss -ltnp | grep 27017
```

Opciones:

- **Usar ese MongoDB** y no crear el contenedor: dejá
  `MONGODB_URI=mongodb://localhost:27017/phantombids` en el `.env`.
- **Detener el servicio** de Windows (PowerShell como administrador:
  `Stop-Service MongoDB`) y crear el contenedor.
- **Usar otro puerto** para el contenedor, por ejemplo 27018:

  **PowerShell**
  ```powershell
  docker run -d --name phantombids-mongo -p 27018:27017 mongo:8.2
  ```

  **bash**
  ```bash
  docker run -d --name phantombids-mongo -p 27018:27017 mongo:8.2
  ```

  y en el `.env`: `MONGODB_URI=mongodb://localhost:27018/phantombids`.

### Node con versión menor a 20.19

Síntomas: `node -v` muestra algo como `v18.x` o `v20.10.0`; `npm install` avisa
*"EBADENGINE Unsupported engine"*; o la API se cae al arrancar con errores de
sintaxis dentro de `node_modules/mongoose`.

Esta versión de la base de datos (Mongoose 9) **exige Node 20.19 o mayor**.

**PowerShell**
```powershell
winget upgrade OpenJS.NodeJS.LTS
```

**bash**
```bash
# con nvm:
nvm install --lts
nvm use --lts
```

O instalá la LTS desde <https://nodejs.org>. Si usás **nvm-windows**:
`nvm install lts` y `nvm use lts`. Después **cerrá y abrí la terminal**,
comprobá `node -v`, y repetí `npm install` dentro de la carpeta del proyecto.

### npm bloqueado en PowerShell

Mensaje: *"No se puede cargar el archivo …\npm.ps1 porque la ejecución de scripts
está deshabilitada en este sistema"*.

Es una política de seguridad de PowerShell. Habilitala solo para tu usuario:

**PowerShell — solo Windows, no tiene equivalente en bash**
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Respondé `S` (o `Y`). Alternativa sin cambiar nada: escribí `npm.cmd` en lugar
de `npm` (por ejemplo `npm.cmd install`).

### Atlas: `Server selection timed out`, `bad auth` o `querySrv`

- **`bad auth : authentication failed`**: usuario o contraseña incorrectos en la
  cadena, o la contraseña tiene caracteres especiales (ver la advertencia del
  paso A.2).
- **`Server selection timed out`**: Atlas rechaza tu conexión. Revisá que
  **Network Access** tenga `0.0.0.0/0` en estado **Active**. Algunas redes
  (universidad, trabajo) bloquean el puerto 27017 hacia afuera: probá desde otra
  red (por ejemplo, compartiendo internet desde el celular) o usá el camino B.
- **`querySrv ECONNREFUSED` o `querySrv ETIMEOUT`**: tu red no resuelve las
  direcciones `mongodb+srv`. En Atlas, **Connect → Drivers**, elegí una versión
  de driver antigua (por ejemplo *Node.js 2.2.12 or later*) para obtener la
  cadena larga que empieza con `mongodb://` (sin `+srv`), y agregale el nombre
  de la base antes del `?` igual que en el paso A.5. Otra opción es cambiar el
  DNS de Windows a `8.8.8.8`.

### `❌ Configuración inválida. Revisá las variables de entorno`

La lista que aparece debajo dice exactamente qué variable del `.env` falta o
está mal. Corregila (paso 4) y repetí.

### `El seed BORRA todas las colecciones` (y se niega a correr)

En tu `.env` quedó `NODE_ENV=production`. Cambialo a `NODE_ENV=development`.

### `No se pudo levantar el servidor: el puerto 3000 ya está en uso`

Otro programa usa el puerto 3000. Cambiá el puerto en el `.env` (`PORT=3001`) o
solo por esta vez:

**PowerShell**
```powershell
$env:PORT = "3001"; npm run dev
```

**bash**
```bash
PORT=3001 npm run dev
```

y usá ese número en las direcciones del navegador.

### `/health` responde `"db":"disconnected"` (código 503)

La API arrancó pero perdió la base. Camino A: revisá tu conexión a internet.
Camino B: `docker start phantombids-mongo`. Después recargá.

### Login responde 401 "Credenciales inválidas"

No corriste el seed (paso 5), o lo corriste contra otra base distinta de la que
usa la API. Comprobá que la línea `MongoDB conectado (base: …)` del paso 6 diga
la misma base en la que corriste el seed.

### Respuesta 429 "Demasiados intentos"

Fallaste el login 10 veces en 15 minutos. Reiniciá la API (**Ctrl + C** y
`npm run dev`) para limpiar el contador.

---

## Después de desplegar en Render: último paso

Cuando la API ya esté publicada en Render siguiendo
[`DESPLIEGUE.md`](DESPLIEGUE.md) (con la cadena de la base **`phantombids`**,
no la de `phantombids_dev`), queda **un último paso**: poner la URL real en el
README.

1. Abrí `README.md`. Arriba de todo, en la sección **API en producción**, hay un
   comentario `<!-- URL_RENDER: reemplazar al desplegar … -->` y tres apariciones
   de `URL_RENDER`.
2. Reemplazá las tres por la URL del servicio (por ejemplo
   `https://phantombids-api.onrender.com`, sin `/` al final) y borrá el
   comentario.
3. Comprobá que no quedó ninguna:

   **PowerShell**
   ```powershell
   Select-String -Path README.md -Pattern URL_RENDER
   ```

   **bash**
   ```bash
   grep -n URL_RENDER README.md
   ```

   No tiene que imprimir nada.
4. En la colección de Postman, cambiá la variable `baseUrl` por esa misma URL
   para recorrer la API desplegada.
