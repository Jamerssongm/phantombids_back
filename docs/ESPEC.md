# PhantomBids — Especificación de la asignatura

> Transcripción literal del documento entregado por la docente.
> **Este archivo es la fuente de verdad del proyecto.** No se modifica salvo que la
> docente entregue material nuevo. Cualquier regla que no aparezca aquí es
> desconocida y debe marcarse en el código como `TODO(reglas)`.
>
> Estado: **incompleto**. El documento cubre únicamente la repartición del
> frontend. Los "Módulos A–H" se mencionan pero no están definidos. Las reglas de
> negocio (resolución de subastas, cálculo de reputación, efectos de las
> maldiciones, fórmulas de rankings) están pendientes de entrega.

---

## REPARTICIÓN FRONTEND: "PHANTOMBIDS"

**Stack Tecnológico:** React + Tailwind CSS + React Icons

---

## INTEGRANTE 1: Layout, Autenticación, Casas y Objetos

Este integrante construye la estructura base con Tailwind, el sistema de
navegación en React Router, la capa de entrada (Auth) y la gestión de Casas de
Subastas y Objetos Embrujados.

### 1. Layout Base, Navegación y UI Atómica

- **Navbar y Footer Responsivos:** Navbar principal con enlaces de navegación,
  toggle de estado, avatar del usuario y uso de iconos como `FiGhost`, `FiHome`,
  `FiUser`, `FiLogOut` (de `react-icons/fi` o `react-icons/gi`).
- **Router Base:** Configuración de `react-router-dom` (Routes, Route) y
  plantilla base (Layout).
- **UI Components (Tailwind):** Creación de componentes atómicos reutilizables:
  - `Button` (variantes: *primary*, *danger*, *ghost* con clases Tailwind).
  - `Input` (campos de texto con iconos prefijados como `FiMail`, `FiLock`,
    `FiSearch`).
  - `Card` (contenedor con bordes redondeados, sombras oscuras y efectos hover).

### 2. Autenticación y Perfil (Módulo A)

- **Vista de Login y Registro (`/login`, `/register`):** Formularios maquetados
  con validación visual en React, estilos de foco en Tailwind y toggle para
  mostrar/ocultar contraseña (`FiEye`, `FiEyeOff`).
- **Vista de Perfil de Usuario (`/profile`):** Grid de Tailwind que muestra
  avatar, nivel de reputación (badge con `GiLaurelCrown`), alias anónimo generado
  (`[Adjetivo]_[Número]`) y fecha de registro.

### 3. Haunt Houses y Objetos Malditos (Módulos B y C)

- **Dashboard de Casas (`/houses`):** Layout en Grid
  (`grid-cols-1 md:grid-cols-3`) para tarjetas de casas según su temática
  (*Darkness, Comedy, Terror, Corporate*) con badges de color y filtros por
  nombre/código.
- **Detalle de Casa (`/house/:id`):** Header con imagen de portada, listado de
  miembros con badges de roles (*Head Haunter*, *Senior Spook*, *Spirit*,
  *Poltergeist*) usando iconos descriptivos (`GiWizardStaff`, `GiGhostSlime`).
- **Modal / Vista de Creación de Objetos (`/objects/new`):** Formulario con
  inputs para nombre, imagen, rangos de puja (`min_bid`, `max_bid`) y un selector
  interactivo tipo grid para elegir 1 de las 8 maldiciones predefinidas.

---

## INTEGRANTE 2: Subastas Inversas, Apuestas, Penalizaciones y Rankings

Este integrante maqueta las pantallas principales de subastas secretas, la
interfaz de pujas y apuestas en tiempo real, el registro de maldiciones y los
tableros analíticos.

### 1. Kit de Componentes de Subasta

- **Componentes de Estado y Temporizadores:** Componente `CountdownTimer`
  maquetado con `FiClock` y estilos de advertencia Tailwind (animaciones *pulse*,
  tonos rojos/amarillos).
- **Badges y Alert Banners:** Alert boxes para notificaciones de penalización por
  puja duplicada y bajada de reputación (`FiAlertTriangle`, `FiShieldOff`).

### 2. Motor Visual de Subasta (Módulos D y E)

- **Detalle de Subasta (`/auction/:id`):** Vista principal maquetada en dos
  columnas (`flex-col lg:flex-row`). Muestra la foto del objeto embrujado, la
  maldición asociada y el rango permitido de oferta.
- **Formulario de Puja Secreta:** Campo de entrada numérica con botones paso a
  paso (`FiMinus`, `FiPlus`) restringido entre `min_bid` y `max_bid`, indicando
  con un aviso visual que la puja permanece oculta hasta el cierre.
- **Pantalla de Cierre / Ganador (`/auction/:id/result`):** Renderizado
  condicional para mostrar el alias anónimo ganador con confeti/efectos de
  triunfo (`GiTrophy`), o el banner de subasta cancelada por falta de pujas
  únicas.

### 3. Apuestas, Maldiciones y Leaderboards (Módulos F, G y H)

- **Panel de Apuestas Paralelas:** Widget lateral o modal dentro de la subasta
  con botones de fichas de reputación (5, 10, 25, 50), selector de alias anónimo
  e indicador del multiplicador 3x (`GiDiceTarget`).
- **Curse Log (`/profile/curses`):** Vista de historial con tarjetas de
  maldiciones activas, barras de progreso de tiempo restante en Tailwind y
  estados de sanción.
- **Dashboard de Rankings (`/rankings`):** Vista con tabs maquetados en React
  (Worst Bidder, Total Cursed, Free Spirit, Betting Prophet) usando tablas
  responsivas de Tailwind y medallas distintivas (`GiSkullCrossbones`,
  `GiFlames`).

---

## CONTRATO DE INTEGRACIÓN UI

- **Paquete de Iconos:** Acordar el uso de colecciones estándar de `react-icons`
  (por ejemplo, `react-icons/fi` para interfaz general y `react-icons/gi` para
  temática fantasma/mística).
- **Paleta de Colores Tailwind:** Configurar de antemano el archivo
  `tailwind.config.js` con los colores temáticos del proyecto (ej. tonos
  `slate-900`, `purple-950`, `emerald-500` para reputación y `rose-600` para
  penalizaciones) para que ambos integrantes usen las mismas clases visuales.

---

## Vacíos conocidos (pendientes de la docente)

Estos puntos NO están definidos en el documento. El código debe marcarlos como
`TODO(reglas)` y no asumir una implementación.

1. Definición formal de los Módulos A, B, C, D, E, F, G y H.
2. Regla de resolución de la subasta inversa: cómo se determina el ganador y bajo
   qué condición exacta se cancela por "falta de pujas únicas".
3. Cómo se calcula y modifica la reputación de un usuario.
4. Nombre, efecto y duración de cada una de las 8 maldiciones predefinidas.
5. Condiciones exactas que disparan una penalización por puja duplicada.
6. Reglas de las apuestas paralelas más allá del multiplicador 3x indicado.
7. Métrica que mide cada uno de los 4 rankings.
8. Permisos asociados a cada rol dentro de una Haunt House.
9. Alcance del backend: si el proyecto es solo frontend maquetado o incluye
   persistencia. **Asunción actual: solo frontend con datos mock.**
