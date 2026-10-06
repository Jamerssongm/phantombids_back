import { fileURLToPath } from 'node:url';
import swaggerJSDoc from 'swagger-jsdoc';

/**
 * Especificación OpenAPI servida en /api/docs.
 *
 * - Lo reutilizable (schemas, respuestas, parámetros, seguridad) se define acá,
 *   en TypeScript.
 * - Cada endpoint se documenta con un bloque `@openapi` encima de su ruta, en
 *   src/routes/*.routes.ts.
 *
 * TRAMPA RESUELTA: swagger-jsdoc lee esos comentarios de los ARCHIVOS FUENTE. Con
 * `npm run dev` (tsx) el código corre desde src/*.ts; con `npm start`, desde
 * dist/*.js. Por eso la carpeta de rutas se resuelve relativa a ESTE módulo
 * (import.meta.url), que vive en src/config o en dist/config según el modo, y el
 * patrón acepta .ts y .js. tsc conserva los comentarios JSDoc al compilar
 * (removeComments está en false, su valor por defecto): no activarlo.
 */
const routesDir = fileURLToPath(new URL('../routes/', import.meta.url));
const appDir = fileURLToPath(new URL('../', import.meta.url));

// ─── Schemas ────────────────────────────────────────────────────────────────

const id = { type: 'string', example: '6ac5835ce2b121d105b9aa7d' };
const timestamps = {
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
};
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const schemas: Record<string, object> = {
  Error: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Los datos enviados no son válidos' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'email' },
                location: { type: 'string', example: 'body' },
                value: {},
                message: { type: 'string', example: 'El email no tiene un formato válido' },
              },
            },
          },
        },
      },
    },
  },
  PaginationMeta: {
    type: 'object',
    properties: {
      total: { type: 'integer', example: 42 },
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      totalPages: { type: 'integer', example: 3 },
    },
  },
  User: {
    type: 'object',
    description: 'Perfil completo: lo ven el propio usuario y los admin.',
    properties: {
      id,
      email: { type: 'string', format: 'email', example: 'sombrio@phantombids.dev' },
      displayName: { type: 'string', example: 'Lucía Sombra' },
      alias: { type: 'string', example: 'Sombrio_042', pattern: '^[A-Z][a-z]+_\\d{3}$' },
      role: { type: 'string', enum: ['admin', 'user'] },
      reputation: { type: 'integer', minimum: 0, example: 100 },
      avatarUrl: { type: 'string', format: 'uri' },
      isActive: { type: 'boolean' },
      ...timestamps,
    },
  },
  PublicUser: {
    type: 'object',
    description:
      'Datos públicos de un usuario cuando aparece dentro de otro recurso. Nunca incluye email.',
    properties: {
      id,
      alias: { type: 'string', example: 'Nocturno_186' },
      displayName: { type: 'string', example: 'Martina Noche' },
      avatarUrl: { type: 'string', format: 'uri' },
      isActive: { type: 'boolean' },
    },
  },
  AuthResult: {
    type: 'object',
    properties: {
      user: ref('User'),
      token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…' },
    },
  },
  Curse: {
    type: 'object',
    properties: {
      id,
      name: { type: 'string', example: 'Niebla del Olvido' },
      description: { type: 'string' },
      icon: { type: 'string', example: 'GiFog' },
      durationHours: { type: 'integer', minimum: 12, maximum: 72, example: 36 },
      severity: { type: 'string', enum: ['minor', 'moderate', 'severe'] },
      ...timestamps,
    },
  },
  CurseInput: {
    type: 'object',
    required: ['name', 'description', 'icon', 'durationHours', 'severity'],
    properties: {
      name: { type: 'string', minLength: 3, maxLength: 60, example: 'Grito Hueco' },
      description: {
        type: 'string',
        minLength: 3,
        maxLength: 300,
        example: 'Un eco que no se apaga.',
      },
      icon: { type: 'string', example: 'GiScreaming' },
      durationHours: {
        type: 'integer',
        example: 24,
        description: 'minor 12–24, moderate 36–48, severe 72 (REGLAS.md §4)',
      },
      severity: { type: 'string', enum: ['minor', 'moderate', 'severe'], example: 'minor' },
    },
  },
  HauntHouse: {
    type: 'object',
    properties: {
      id,
      name: { type: 'string', example: 'Casa Oscuridad' },
      code: { type: 'string', example: 'DRK' },
      theme: { type: 'string', enum: ['darkness', 'comedy', 'terror', 'corporate'] },
      description: { type: 'string' },
      coverImageUrl: { type: 'string', format: 'uri' },
      createdBy: id,
      ...timestamps,
    },
  },
  HouseInput: {
    type: 'object',
    required: ['name', 'code', 'theme'],
    properties: {
      name: { type: 'string', minLength: 3, maxLength: 60, example: 'Casa del Eco' },
      code: { type: 'string', pattern: '^[A-Za-z0-9]{3,10}$', example: 'ECO' },
      theme: {
        type: 'string',
        enum: ['darkness', 'comedy', 'terror', 'corporate'],
        example: 'comedy',
      },
      description: { type: 'string', maxLength: 500, nullable: true },
      coverImageUrl: { type: 'string', format: 'uri', nullable: true },
    },
  },
  HouseDetail: {
    allOf: [
      ref('HauntHouse'),
      {
        type: 'object',
        properties: {
          members: { type: 'array', items: ref('HouseMembership') },
          objects: { type: 'array', items: ref('CursedObject') },
        },
      },
    ],
  },
  HouseMembership: {
    type: 'object',
    properties: {
      id,
      user: ref('PublicUser'),
      house: id,
      houseRole: {
        type: 'string',
        enum: ['head_haunter', 'senior_spook', 'spirit', 'poltergeist'],
      },
      joinedAt: { type: 'string', format: 'date-time' },
      ...timestamps,
    },
  },
  CursedObject: {
    type: 'object',
    properties: {
      id,
      name: { type: 'string', example: 'Vela que Nunca se Apaga' },
      imageUrl: { type: 'string', format: 'uri' },
      house: {
        type: 'object',
        properties: {
          id,
          name: { type: 'string' },
          code: { type: 'string' },
          theme: { type: 'string' },
        },
      },
      curse: ref('Curse'),
      minBid: { type: 'integer', minimum: 1, example: 30 },
      maxBid: { type: 'integer', minimum: 1, example: 250 },
      createdBy: id,
      ...timestamps,
    },
  },
  ObjectInput: {
    type: 'object',
    required: ['name', 'house', 'curse', 'minBid', 'maxBid'],
    properties: {
      name: { type: 'string', minLength: 3, maxLength: 80, example: 'Llave del Desván' },
      imageUrl: { type: 'string', format: 'uri', nullable: true },
      house: id,
      curse: id,
      minBid: { type: 'integer', minimum: 1, example: 10 },
      maxBid: {
        type: 'integer',
        minimum: 1,
        example: 80,
        description: 'Debe ser mayor que minBid',
      },
    },
  },
  Auction: {
    type: 'object',
    properties: {
      id,
      object: ref('CursedObject'),
      status: { type: 'string', enum: ['scheduled', 'open', 'closed', 'cancelled'] },
      opensAt: { type: 'string', format: 'date-time' },
      closesAt: { type: 'string', format: 'date-time' },
      winner: ref('PublicUser'),
      winningBid: { type: 'integer', description: 'Solo con la subasta cerrada' },
      cancellationReason: { type: 'string', enum: ['no_unique_bids', 'no_bids'] },
      resolvedAt: { type: 'string', format: 'date-time' },
      settledAt: { type: 'string', format: 'date-time' },
      createdBy: id,
      ...timestamps,
    },
  },
  AuctionDetail: {
    allOf: [
      ref('Auction'),
      {
        type: 'object',
        properties: {
          myBid: {
            nullable: true,
            description:
              'La puja propia del usuario autenticado, o null. Es lo ÚNICO de las pujas que se ve mientras la subasta está scheduled/open.',
            allOf: [ref('Bid')],
          },
        },
      },
    ],
  },
  AuctionInput: {
    type: 'object',
    required: ['object', 'opensAt', 'closesAt'],
    properties: {
      object: id,
      opensAt: { type: 'string', format: 'date-time', description: 'En el futuro' },
      closesAt: { type: 'string', format: 'date-time', description: 'Posterior a opensAt' },
    },
  },
  AuctionResult: {
    type: 'object',
    properties: {
      auction: ref('Auction'),
      status: { type: 'string', enum: ['closed', 'cancelled'] },
      winner: { nullable: true, allOf: [ref('PublicUser')] },
      winningBid: { type: 'integer', nullable: true, example: 55 },
      cancellationReason: { type: 'string', nullable: true, enum: ['no_unique_bids', 'no_bids'] },
      resolvedAt: { type: 'string', format: 'date-time' },
      settledAt: { type: 'string', format: 'date-time' },
      bids: { type: 'array', items: ref('RevealedBid') },
      penalties: { type: 'array', items: ref('Penalty') },
      bets: {
        type: 'object',
        description: 'Resumen de apuestas por resultado',
        example: { won: { count: 2, payout: 180 }, lost: { count: 1, payout: 0 } },
      },
    },
  },
  Bid: {
    type: 'object',
    properties: {
      id,
      auction: id,
      amount: { type: 'integer', example: 77 },
      isDuplicate: { type: 'boolean', description: 'Se decide al cerrar la subasta' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  RevealedBid: {
    allOf: [ref('Bid'), { type: 'object', properties: { user: ref('PublicUser') } }],
  },
  Participant: {
    type: 'object',
    description: 'Quién pujó, sin el monto (REGLAS.md §2b).',
    properties: {
      id,
      alias: { type: 'string', example: 'Errante_119' },
      avatarUrl: { type: 'string' },
    },
  },
  Penalty: {
    type: 'object',
    properties: {
      id,
      user: ref('PublicUser'),
      curse: ref('Curse'),
      reason: { type: 'string' },
      imposedAt: { type: 'string', format: 'date-time' },
      expiresAt: { type: 'string', format: 'date-time' },
      status: { type: 'string', enum: ['active', 'served', 'expired'] },
      reputationLoss: { type: 'integer', example: 10 },
    },
  },
  SideBet: {
    type: 'object',
    properties: {
      id,
      auction: ref('Auction'),
      bettor: id,
      targetUser: ref('PublicUser'),
      chips: { type: 'integer', enum: [5, 10, 25, 50] },
      result: { type: 'string', enum: ['pending', 'won', 'lost'] },
      payout: { type: 'integer', example: 0, description: '3 × chips si gana' },
      ...timestamps,
    },
  },
  UserCurseEntry: {
    type: 'object',
    properties: {
      id,
      user: id,
      curse: ref('Curse'),
      reason: { type: 'string' },
      sourceAuction: { type: 'object' },
      imposedAt: { type: 'string', format: 'date-time' },
      expiresAt: { type: 'string', format: 'date-time' },
      status: {
        type: 'string',
        enum: ['active', 'served', 'expired'],
        description: 'Estado efectivo, calculado al vuelo',
      },
      remainingSeconds: { type: 'integer', example: 21600 },
      progress: { type: 'number', minimum: 0, maximum: 1, example: 0.5 },
    },
  },
  RankingEntry: {
    type: 'object',
    properties: {
      rank: { type: 'integer', example: 1 },
      user: ref('PublicUser'),
      value: {
        type: 'number',
        example: 0.6667,
        description: 'Conteo, o tasa de acierto en betting-prophet',
      },
      won: { type: 'integer', description: 'Solo betting-prophet' },
      resolved: { type: 'integer', description: 'Solo betting-prophet' },
    },
  },
  ApiInfo: {
    type: 'object',
    properties: {
      name: { type: 'string', example: 'PhantomBids API' },
      version: { type: 'string', example: '0.1.0' },
      docs: { type: 'string', example: '/api/docs' },
    },
  },
};

// ─── Respuestas ─────────────────────────────────────────────────────────────

const json = (schema: object) => ({ 'application/json': { schema } });
const envelope = (data: object, meta = false) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data,
    ...(meta ? { meta: ref('PaginationMeta') } : {}),
  },
});
const errorResponse = (description: string) => ({ description, content: json(ref('Error')) });

/**
 * Para cada recurso se generan cuatro respuestas: `XOk` (200, un elemento),
 * `XCreated` (201 + Location), `XList` (200, array) y `XPage` (200, array + meta).
 * Los bloques @openapi de las rutas las referencian por nombre.
 */
const responseResources = [
  'User',
  'AuthResult',
  'Curse',
  'HauntHouse',
  'HouseDetail',
  'HouseMembership',
  'CursedObject',
  'Auction',
  'AuctionDetail',
  'AuctionResult',
  'Bid',
  'RevealedBid',
  'Participant',
  'SideBet',
  'UserCurseEntry',
  'RankingEntry',
  'ApiInfo',
];

const responses: Record<string, object> = {
  NoContent: { description: 'Hecho, sin cuerpo' },
  BadRequest: errorResponse('400 — request mal formada: id inválido en la URL o JSON roto'),
  Unauthorized: errorResponse(
    '401 — falta el token, es inválido o expiró, o la cuenta está desactivada',
  ),
  Forbidden: errorResponse('403 — autenticado pero sin permiso'),
  NotFound: errorResponse('404 — el recurso no existe'),
  Conflict: errorResponse(
    '409 — conflicto con el estado actual (duplicado, subasta cerrada, etc.)',
  ),
  ValidationError: errorResponse('422 — datos de body o query inválidos, con detalle por campo'),
  TooManyRequests: errorResponse('429 — demasiados intentos, probar en 15 minutos'),
};
for (const name of responseResources) {
  responses[`${name}Ok`] = { description: 'OK', content: json(envelope(ref(name))) };
  responses[`${name}List`] = {
    description: 'OK',
    content: json(envelope({ type: 'array', items: ref(name) })),
  };
  responses[`${name}Page`] = {
    description: 'OK, paginado',
    content: json(envelope({ type: 'array', items: ref(name) }, true)),
  };
  responses[`${name}Created`] = {
    description: 'Creado',
    headers: {
      Location: { description: 'URL del recurso creado', schema: { type: 'string' } },
    },
    content: json(envelope(ref(name))),
  };
}

// ─── Parámetros ─────────────────────────────────────────────────────────────

const parameters = {
  Id: {
    name: 'id',
    in: 'path',
    required: true,
    description: 'ObjectId (24 caracteres hex)',
    schema: { type: 'string', pattern: '^[a-f0-9]{24}$' },
  },
  UserIdPath: {
    name: 'userId',
    in: 'path',
    required: true,
    description: 'ObjectId del usuario',
    schema: { type: 'string', pattern: '^[a-f0-9]{24}$' },
  },
  Page: { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  Limit: {
    name: 'limit',
    in: 'query',
    description: 'Máximo 100 (un valor mayor se recorta)',
    schema: { type: 'integer', minimum: 1, default: 20 },
  },
};

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'PhantomBids API',
      version: '0.1.0',
      description:
        'API REST de PhantomBids: subastas inversas secretas de puja única más baja.\n\n' +
        '**Cómo probar los endpoints protegidos:** ejecutá `POST /api/auth/login` (admin del seed: ' +
        '`admin@phantombids.dev` / `Admin123!`), copiá el `token` de la respuesta, tocá **Authorize** ' +
        'arriba a la derecha y pegalo (sin la palabra Bearer).\n\n' +
        'Todas las respuestas tienen la forma `{ success, data }` o `{ success: false, error: { message, code, details } }`.',
    },
    // Relativo: funciona igual en local y en Render, sin configurar la URL.
    servers: [{ url: '/', description: 'Este servidor' }],
    tags: [
      { name: 'Sistema', description: 'Estado del servicio' },
      { name: 'Auth', description: 'Registro, login y perfil propio' },
      { name: 'Users', description: 'Usuarios (admin) y perfiles públicos' },
      { name: 'Curses', description: 'Catálogo de las maldiciones' },
      { name: 'Houses', description: 'Haunt Houses' },
      { name: 'Members', description: 'Miembros de una casa y sus roles' },
      { name: 'Objects', description: 'Objetos malditos' },
      { name: 'Auctions', description: 'Subastas, cierre y resultado' },
      { name: 'Bids', description: 'Pujas secretas' },
      { name: 'Bets', description: 'Apuestas paralelas' },
      { name: 'Rankings', description: 'Tableros calculados por agregación' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas,
      responses,
      parameters,
    },
  },
  apis: [`${routesDir}*.routes.{ts,js}`, `${appDir}app.{ts,js}`],
});
