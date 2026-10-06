# Rúbrica — Entrega 2 (Backend)

> Transcripción literal del documento entregado por la docente.
> **Este archivo es el instrumento de calificación.** Ante cualquier duda de
> diseño, manda esta rúbrica sobre cualquier otra consideración técnica.

## Fechas clave

| Hito | Fecha |
|---|---|
| Entrega 2 | 3 de octubre, 11:59 PM |
| Entrega 3 | 31 de octubre |
| Sustentación | 6 de noviembre |

## Tabla de criterios

| Criterio | Pts |
|---|---|
| 1. Estructura | 10 |
| 2. Modelos | 10 |
| 3. CRUD | 20 |
| 4. JWT | 15 |
| 5. Roles | 10 |
| 6. Errores y validaciones | 10 |
| 7. Variables de entorno | 10 |
| 8. Despliegue | 10 |
| 9. Documentación | 5 |
| **TOTAL** | **100** |

---

## Detalle de cada criterio

### 1. Estructura y arquitectura en capas (10 pts)

| Nivel | Descripción |
|---|---|
| 10 pts | Carpetas `models/`, `services/`, `controllers/`, `routes/`, `middlewares/`, `utils/` claras |
| 7 pts | Carpetas básicas pero organizadas |
| 4 pts | Archivos sueltos o desordenados |
| 0 pts | Sin estructura |

### 2. Modelos de Mongoose (10 pts)

| Nivel | Descripción |
|---|---|
| 10 pts | Schemas con validaciones (`required`, `minlength`, `enum`, etc.) |
| 7 pts | Schemas básicos sin validaciones |
| 4 pts | Schemas incompletos |
| 0 pts | Sin modelos |

### 3. CRUD completo (20 pts)

| Nivel | Descripción |
|---|---|
| 20 pts | Todos los endpoints funcionan (GET, POST, PUT, DELETE) con datos reales |
| 15 pts | Faltan 1-2 endpoints |
| 8 pts | Faltan 3+ endpoints |
| 0 pts | No funciona |

### 4. Autenticación JWT (15 pts)

| Nivel | Descripción |
|---|---|
| 15 pts | Registro, login, middleware, protección de rutas |
| 10 pts | Registro y login funcionan, protección parcial |
| 5 pts | Autenticación incompleta |
| 0 pts | No implementa |

### 5. Autorización por roles (10 pts)

| Nivel | Descripción |
|---|---|
| 10 pts | Middleware `autorizar`, roles `admin`/`user`, rutas protegidas |
| 7 pts | Roles implementados pero sin protección completa |
| 4 pts | Roles incompletos |
| 0 pts | No implementa |

### 6. Manejo de errores y validaciones (10 pts)

| Nivel | Descripción |
|---|---|
| 10 pts | Middleware de errores global, validaciones con `express-validator`, códigos HTTP correctos |
| 7 pts | Errores manejados pero sin validaciones |
| 4 pts | Manejo de errores básico |
| 0 pts | Sin manejo de errores |

### 7. Variables de entorno (10 pts)

| Nivel | Descripción |
|---|---|
| 10 pts | `.env` configurado, `.env.example` presente, `.gitignore` con `.env` |
| 7 pts | `.env` configurado pero sin `.env.example` |
| 4 pts | Variables en el código |
| 0 pts | Sin variables de entorno |

### 8. Despliegue (10 pts)

| Nivel | Descripción |
|---|---|
| 10 pts | API desplegada en Railway/Render, URL funcional, variables configuradas |
| 7 pts | Desplegada pero con errores menores |
| 4 pts | Intento de despliegue fallido |
| 0 pts | No desplegada |

### 9. Documentación (5 pts)

| Nivel | Descripción |
|---|---|
| 5 pts | README completo + Swagger UI funcionando |
| 3 pts | README completo sin Swagger |
| 1 pt | README básico |
| 0 pts | Sin documentación |

---

## Implicaciones directas para el código

Lecturas literales de la rúbrica que condicionan decisiones de implementación:

1. **Criterio 1** nombra seis carpetas de forma explícita. Deben existir con esos
   nombres exactos, aunque alguna quede casi vacía.
2. **Criterio 2** exige validaciones en los schemas, no solo campos declarados.
3. **Criterio 5** nombra el middleware **`autorizar`** en español. Se usa ese
   nombre literal.
4. **Criterio 5** define los roles globales como `admin` y `user`. Los cuatro
   roles de casa del enunciado (`head_haunter`, `senior_spook`, `spirit`,
   `poltergeist`) son un eje distinto y no reemplazan a estos.
5. **Criterio 6** nombra `express-validator` de forma explícita. No se sustituye
   por Zod, Joi ni validación manual.
6. **Criterio 7** exige que `.env.example` exista en el repositorio y que `.env`
   esté en `.gitignore`.
7. **Criterio 8** exige una **URL funcional**, no solo el intento de despliegue.
8. **Criterio 9** exige Swagger UI **funcionando**, lo que implica que debe
   funcionar también en el servicio desplegado, no solo en local.
