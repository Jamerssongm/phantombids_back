# Reglas de negocio asumidas — PhantomBids Backend

> **Advertencia importante.** El enunciado de la asignatura (`docs/ESPEC.md`)
> describe las pantallas del frontend, pero **no define las reglas de negocio**
> del producto: no dice cómo se resuelve una subasta, cómo se calcula la
> reputación, qué efecto tiene cada maldición ni qué mide cada ranking.
>
> Este documento recoge los supuestos mínimos y coherentes con lo que el
> enunciado sí describe. Se adoptan porque un backend, a diferencia de un
> frontend maquetado, no puede dejar esas decisiones sin tomar.
>
> **Toda la lógica derivada de este documento vive aislada en módulos propios**
> (`services/auctionResolver.service.ts`, `services/reputation.service.ts`,
> `services/ranking.service.ts`) para poder reemplazarla cuando la docente
> entregue las reglas definitivas, sin tocar el resto del sistema.
>
> Cuando lleguen las reglas oficiales: actualizar este archivo primero, después
> el código, y dejar registro del cambio.

---

## 1. Reputación

- Todo usuario arranca con **100** puntos de reputación.
- La reputación **nunca baja de 0**.
- Es la moneda con la que se apuesta en las apuestas paralelas.
- Movimientos definidos:

| Evento | Efecto |
|---|---|
| Registro | +100 (saldo inicial) |
| Puja duplicada | −10 |
| Apostar N fichas | −N (al momento de apostar) |
| Apuesta ganada | +3N (neto +2N sobre lo apostado) |
| Apuesta perdida | 0 (las fichas ya se descontaron) |
| Apuesta cancelada | +N (devolución) |
| Ganar una subasta | sin efecto |

---

## 2. Subasta inversa de puja única más baja

### Mecánica

- Las pujas son **secretas**: ningún usuario puede ver las de otro mientras la
  subasta siga `scheduled` u `open`.
- Un usuario puede hacer **una sola puja** por subasta. No se modifica ni se
  retira.
- El monto es un **entero** dentro de `[minBid, maxBid]`, ambos inclusive.

### Resolución al cierre

1. Se agrupan todas las pujas por monto.
2. Un monto es **único** si exactamente un usuario lo ofreció.
3. **Gana la puja única más baja.** Ese usuario se adjudica el objeto.
4. Si **ningún** monto es único, la subasta se marca `cancelled` con motivo
   `no_unique_bids`. No hay ganador y el objeto no se adjudica.
5. Si no hubo ninguna puja, la subasta se marca `cancelled` con motivo
   `no_bids`.

### Ejemplo

Pujas: `[12, 15, 15, 18, 20, 20, 23]`

- Montos con una sola puja: `12`, `18`, `23`
- Montos duplicados: `15` (×2), `20` (×2)
- **Ganador:** quien pujó `12`
- **Penalizados:** los cuatro usuarios que pujaron `15` o `20`

Si en cambio las pujas fueran `[15, 15, 20, 20]`, ningún monto sería único y la
subasta se cancelaría, penalizando a los cuatro.

---

## 3. Penalización por puja duplicada

- Si dos o más usuarios ofrecen **el mismo monto**, **todos** quedan marcados
  con `isDuplicate: true`.
- Cada uno pierde **10** puntos de reputación.
- Cada uno recibe una **maldición activa**, elegida al azar del catálogo de 8,
  con la duración propia de esa maldición.
- Las maldiciones son **acumulables**: un usuario puede tener varias activas al
  mismo tiempo.
- La penalización se aplica en el momento de la resolución de la subasta, no
  antes: hasta el cierre nadie sabe si su puja estaba duplicada.

---

## 4. Maldiciones

- El catálogo tiene **8 maldiciones predefinidas**, con nombre, descripción,
  icono y **duración en horas** (entre 12 y 72 según severidad).
- Son datos de catálogo, administrados solo por `admin`. No las crea el usuario.
- Escala de duración por severidad (`Curse.severity`):

| Severidad | Duración |
|---|---|
| `minor` | 12 a 24 horas |
| `moderate` | 36 a 48 horas |
| `severe` | 72 horas |

  El schema solo exige el rango global de 12 a 72 horas. La escala por severidad
  la valida `curse.service` al crear o editar una maldición (422 si no la
  respeta) y es la que usa el catálogo sembrado (`src/utils/seed.ts`).
- Una maldición del catálogo solo se puede borrar si ningún objeto ni ninguna
  maldición asignada (`UserCurse`) la referencia (409). Es catálogo, pero la
  historia de sanciones depende de ella.

- Estados de una maldición asignada (`UserCurse`):

| Estado | Significado |
|---|---|
| `active` | Vigente, aún no venció |
| `served` | Cumplida y cerrada explícitamente |
| `expired` | Venció al alcanzarse `expiresAt` |

### Vacío pendiente — el más importante

**El enunciado no define qué efecto tiene cada maldición sobre el sistema.**

Se asume por ahora que las maldiciones se **registran y se muestran**, pero
**no restringen ninguna acción**: un usuario maldito puede seguir pujando,
apostando y creando objetos con normalidad.

Esta decisión es deliberada. Inventar un sistema de restricciones (por ejemplo,
"no podés pujar durante 24 horas") sería inventar producto, y la docente puede
definir algo distinto. El modelo de datos ya guarda todo lo necesario
(`expiresAt`, severidad, estado) para activar efectos sin migrar nada.

---

## 5. Apuestas paralelas

- Se apuesta sobre **quién va a ganar** una subasta que sigue abierta.
- Fichas permitidas: **5, 10, 25, 50**. No se admiten otros valores.
- Las fichas se **descuentan de la reputación al momento de apostar**, no al
  resolver. Si el usuario no tiene saldo suficiente, la apuesta se rechaza.
- **Una sola apuesta por usuario y por subasta.**
- La apuesta se puede **cancelar mientras la subasta siga abierta**, con
  devolución íntegra de las fichas.
- **No se puede apostar por uno mismo.**
- El alias objetivo debe ser un participante real de esa subasta.

### Resolución

| Desenlace | Resultado de la apuesta |
|---|---|
| El alias apostado gana la subasta | `won`, payout = **3 × fichas** |
| El alias apostado no gana | `lost`, payout = 0 |
| La subasta se cancela sin ganador | `lost`, payout = 0 |

El multiplicador 3× es el único dato que el enunciado sí especifica.

---

## 6. Rankings

Los cuatro tableros del enunciado, con la métrica que se asume para cada uno:

| Ranking | Métrica | Orden |
|---|---|---|
| **Worst Bidder** | Número de pujas marcadas como duplicadas | Descendente |
| **Total Cursed** | Número de maldiciones recibidas en toda su historia | Descendente |
| **Free Spirit** | Número de subastas en las que participó sin haber recibido ninguna maldición | Descendente |
| **Betting Prophet** | Tasa de acierto en apuestas: ganadas ÷ resueltas | Descendente |

Reglas comunes:

- **Betting Prophet** exige un mínimo de **3 apuestas resueltas** para aparecer
  en el ranking. Sin ese mínimo, un usuario con una sola apuesta acertada
  tendría 100% y encabezaría el tablero.
- Los usuarios dados de baja (`isActive: false`) no aparecen.
- Se calculan con **pipelines de agregación de MongoDB**, no cargando las
  colecciones a memoria.

---

## 7. Roles — dos ejes independientes

El sistema tiene dos nociones de rol que **no se reemplazan entre sí**.

### Rol global (`User.role`)

Es el que exige la rúbrica (criterio 5) y el que consume el middleware
`autorizar`.

| Rol | Alcance |
|---|---|
| `admin` | Acceso total. Administra usuarios, catálogo de maldiciones y cualquier casa sin necesidad de ser miembro. |
| `user` | Usuario normal. Es el rol por defecto al registrarse. |

**El rol nunca se acepta desde el body del registro.** Se fuerza a `user`.

Reglas de administración de usuarios:

- La baja de un usuario es **lógica** (`isActive: false`), nunca física: pujas,
  apuestas, membresías y maldiciones lo referencian. Un usuario dado de baja no
  puede iniciar sesión y su token deja de servir de inmediato.
- Un `admin` **no puede quitarse su propio rol ni darse de baja a sí mismo**
  (409): el sistema podría quedar sin administradores, y eso no se puede
  revertir por API.
- `reputation` no se edita por API: solo la mueven los eventos de §1.

### Rol de casa (`HouseMembership.houseRole`)

Aplica solo dentro de una Haunt House concreta. Un usuario puede tener roles
distintos en casas distintas.

| Rol de casa | Permisos asumidos |
|---|---|
| `head_haunter` | Administra la casa: edita, agrega y expulsa miembros, cambia roles, cierra subastas |
| `senior_spook` | Participa. Sin permisos de administración |
| `spirit` | Participa |
| `poltergeist` | Participa |

### Vacío pendiente

**El enunciado no define los permisos de cada rol de casa.** Se asume la
jerarquía mínima de arriba: solo `head_haunter` administra, los otros tres son
equivalentes en permisos y se diferencian únicamente en la presentación.

Regla adicional asumida: **una casa no puede quedarse sin `head_haunter`.** No
se permite expulsar ni degradar al último, ni que se retire él mismo (409).

Membresías:

- Quien crea una casa queda como su `head_haunter`.
- Agregan miembros, cambian roles y expulsan: el `head_haunter` de la casa o un
  `admin`. Un `head_haunter` puede nombrar a otros `head_haunter`.
- Cualquier miembro puede salirse solo.
- Rol por defecto al agregar un miembro: `spirit`.
- No se puede agregar a un usuario dado de baja (409).

---

## 7b. Borrados y ediciones con historia

Regla general: **lo que tiene historia de subastas no se borra**. Pujas,
apuestas, maldiciones asignadas y rankings referencian subastas, y las subastas
referencian objetos; borrar un eslabón deja la historia rota.

| Recurso | Regla |
|---|---|
| Objeto — editar | 409 si tiene una subasta `open`: cambiar el rango con pujas en curso corrompe la subasta |
| Objeto — borrar | 409 si tiene alguna subasta en un estado distinto de `scheduled`. Si solo tiene subastas `scheduled`, se borran con él |
| Casa — borrar | 409 si tiene subastas `open`. 409 también si alguno de sus objetos tiene subastas `closed` o `cancelled` (se hereda la regla del objeto). Si pasa, se borran en cascada sus subastas `scheduled`, sus objetos y sus membresías |
| Maldición del catálogo — borrar | 409 si algún objeto o `UserCurse` la referencia |
| Usuario — borrar | Siempre lógico (`isActive: false`), ver §7 |

---

## 8. Resumen de vacíos pendientes de la docente

Lista para trasladar al README y usar como respaldo en la sustentación.

| # | Vacío | Decisión provisional |
|---|---|---|
| 1 | Definición formal de los Módulos A–H | Se infieren del reparto de pantallas del frontend |
| 2 | Regla de resolución de la subasta | Puja única más baja; cancelación si no hay montos únicos |
| 3 | Cálculo de la reputación | Saldo inicial 100, −10 por puja duplicada, ±N por apuestas |
| 4 | Efecto de cada maldición | **Ninguno.** Se registran y se muestran, no restringen acciones |
| 5 | Duración de las maldiciones | Entre 12 y 72 horas según severidad, definida en el catálogo |
| 6 | Condición exacta de puja duplicada | Mismo monto exacto ofrecido por dos o más usuarios |
| 7 | Reglas de apuestas más allá del 3× | Fichas 5/10/25/50, una por subasta, cancelable, no sobre uno mismo |
| 8 | Métrica de cada ranking | Definida en la sección 6 de este documento |
| 9 | Permisos de los roles de casa | Solo `head_haunter` administra |
| 10 | Alcance del backend | API REST completa con persistencia en MongoDB Atlas |
