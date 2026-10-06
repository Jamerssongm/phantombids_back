# PhantomBids API

API REST de PhantomBids, una plataforma de subastas inversas secretas con
temática fantasma: gana la **puja única más baja**, las pujas son secretas hasta
el cierre, y quien repite un monto recibe una maldición y pierde reputación.

Stack: Node.js + Express 4 + TypeScript, MongoDB + Mongoose 9, JWT,
express-validator. Desplegada en Render (ver `docs/DESPLIEGUE.md`).

> README en construcción: la documentación completa de endpoints, instalación y
> Swagger se agrega en la sesión de documentación.

## Inicio rápido

```bash
cp .env.example .env      # completar MONGODB_URI y JWT_SECRET
npm install
npm run seed              # datos de prueba (admin@phantombids.dev / Admin123!)
npm run dev
npm test                  # tests del resolvedor de subastas
```

## Reglas de negocio

Las reglas del producto que el enunciado no define están en
[`docs/REGLAS.md`](docs/REGLAS.md): resolución de la subasta, reputación,
penalizaciones, apuestas, rankings y roles.

## Decisión de diseño: consistencia sin transacciones

El cierre de una subasta escribe en varias colecciones: el estado de la subasta,
las pujas duplicadas, la reputación y las maldiciones de los penalizados, y las
apuestas paralelas con sus pagos. Lo natural sería una transacción de MongoDB,
pero las transacciones **exigen un replica set**, y el entorno de desarrollo es
un Mongo standalone en Docker.

**Se eligió portabilidad sobre atomicidad:** el mismo código corre en un Mongo
suelto y en Atlas. A cambio, el cierre está diseñado para ser **idempotente** y
seguro ante **ejecución concurrente**:

1. **Claim condicional.** El paso `open → closed` es un `findOneAndUpdate` con
   `status: "open"` en el filtro. Si dos procesos intentan cerrar la misma
   subasta (el scheduler y un cierre manual, o cinco requests simultáneos), solo
   uno gana; el resto no hace nada. El claim fija además el corte de pujas
   (`resolvedAt`).
2. **Efectos idempotentes, en orden determinista.** Cada escritura posterior da
   el mismo resultado si se aplica dos veces:
   - el resultado sale de una **función pura** (`services/auctionResolver.ts`)
     sobre un conjunto fijo de pujas;
   - las maldiciones se insertan con upsert sobre `(usuario, subasta)`, que
     además tiene índice único;
   - cada movimiento de reputación tiene una clave única (ej.
     `penalty:<subasta>`) y se aplica en un único `updateOne` atómico que
     verifica la clave, aplica el delta con tope en 0 y registra la clave.
3. **Marca de liquidación.** Al terminar se fija `settledAt`. Si el proceso muere
   a mitad, la subasta queda cerrada sin `settledAt`, y la siguiente pasada del
   scheduler o el siguiente acceso a esa subasta completan lo que faltaba sin
   duplicar lo ya hecho.

**Lo que se resigna:** durante unos milisegundos, otro lector puede ver un estado
intermedio (la subasta ya cerrada con los efectos todavía aplicándose). Nunca se
duplica un efecto ni se pierde uno.

Con Atlas (que sí es replica set) se podría envolver el cierre en una
transacción sin cambiar el diseño: las garantías de idempotencia seguirían
siendo útiles ante reintentos.
