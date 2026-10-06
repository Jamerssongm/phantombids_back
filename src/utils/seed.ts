/**
 * Seed de desarrollo: limpia las colecciones y las repuebla (idempotente).
 *
 *   npm run seed              → falla si NODE_ENV=production
 *   npm run seed -- --force   → corre igual (BORRA la base del despliegue)
 *
 * Nombres de maldiciones, casas, objetos y alias tomados de src/mocks/ del frontend
 * para que ambos lados coincidan. La reputación final de cada usuario se calcula
 * aplicando los movimientos de docs/REGLAS.md §1 a los eventos sembrados.
 */
import bcrypt from 'bcryptjs';
import mongoose, { type Types } from 'mongoose';
import { connectDB } from '../config/database.js';
import { env } from '../config/env.js';
import {
  Auction,
  Bid,
  Curse,
  CursedObject,
  HauntHouse,
  HouseMembership,
  SideBet,
  User,
  UserCurse,
  type AuctionStatus,
  type CancellationReason,
  type CurseSeverity,
  type HouseRole,
  type HouseTheme,
  type SideBetChips,
} from '../models/index.js';

const ADMIN = { email: 'admin@phantombids.dev', password: 'Admin123!' };
const USER_PASSWORD = 'Phantom123!';
const DUPLICATE_PENALTY = 10; // docs/REGLAS.md §1
const BET_MULTIPLIER = 3; // docs/REGLAS.md §5

const HOUR = 60 * 60 * 1000;
const now = Date.now();
const at = (hoursFromNow: number) => new Date(now + hoursFromNow * HOUR);

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

// La severidad y la duración no vienen del frontend: REGLAS.md §4 solo fija el
// rango de 12 a 72 horas. Se reparten minor 12–24, moderate 36–48, severe 72.
const CURSES: {
  name: string;
  description: string;
  icon: string;
  severity: CurseSeverity;
  durationHours: number;
}[] = [
  {
    name: 'Eco del Silencio',
    description: 'Quien la porta ve sus mensajes ignorados por el resto de las casas.',
    icon: 'GiSilence',
    severity: 'minor',
    durationHours: 12,
  },
  {
    name: 'Vinculo Roto',
    description: 'Corta temporalmente la posibilidad de unirse a nuevas subastas.',
    icon: 'GiBreakingChain',
    severity: 'severe',
    durationHours: 72,
  },
  {
    name: 'Sombra Persistente',
    description: 'Reduce visiblemente la reputación mostrada en el perfil.',
    icon: 'GiShadowFollower',
    severity: 'moderate',
    durationHours: 36,
  },
  {
    name: 'Susurro Nocturno',
    description: 'Revela parcialmente el alias real durante la subasta activa.',
    icon: 'GiTalk',
    severity: 'moderate',
    durationHours: 48,
  },
  {
    name: 'Marca del Errante',
    description: 'Aparece como advertencia en el historial público de maldiciones.',
    icon: 'GiWalkingBoot',
    severity: 'minor',
    durationHours: 24,
  },
  {
    name: 'Cadena Espectral',
    description: 'Limita el monto máximo de puja en la próxima subasta.',
    icon: 'GiWavyChains',
    severity: 'severe',
    durationHours: 72,
  },
  {
    name: 'Niebla del Olvido',
    description: 'Oculta temporalmente el ranking del usuario afectado.',
    icon: 'GiFog',
    severity: 'moderate',
    durationHours: 36,
  },
  {
    name: 'Peso del Umbral',
    description: 'Aplica una sanción visual de advertencia en el Curse Log.',
    icon: 'GiWeightCrush',
    severity: 'minor',
    durationHours: 12,
  },
];

const HOUSES: {
  key: string;
  name: string;
  code: string;
  theme: HouseTheme;
  description: string;
  head: string;
}[] = [
  {
    key: 'darkness',
    name: 'Casa Oscuridad',
    code: 'DRK',
    theme: 'darkness',
    description: 'Objetos ligados al vacío y al silencio absoluto. Para coleccionistas serios.',
    head: 'Sombrio_042',
  },
  {
    key: 'comedy',
    name: 'Casa Comedia',
    code: 'COM',
    theme: 'comedy',
    description: 'Fantasmas bromistas y maldiciones inofensivas... casi siempre.',
    head: 'Umbral_333',
  },
  {
    key: 'terror',
    name: 'Casa Terror',
    code: 'TRR',
    theme: 'terror',
    description: 'Horror clásico. Objetos que preferirías no tocar de noche.',
    head: 'Silente_401',
  },
  {
    key: 'corporate',
    name: 'Casa Corporativa',
    code: 'CRP',
    theme: 'corporate',
    description: 'Espíritus de oficina atrapados en reuniones que nunca terminan.',
    head: 'Fantasmal_290',
  },
];

const USERS: { alias: string; displayName: string }[] = [
  { alias: 'Sombrio_042', displayName: 'Lucía Sombra' },
  { alias: 'Errante_119', displayName: 'Mateo Errante' },
  { alias: 'Nebuloso_207', displayName: 'Valentina Niebla' },
  { alias: 'Umbral_333', displayName: 'Tomás Umbral' },
  { alias: 'Gelido_058', displayName: 'Camila Hielo' },
  { alias: 'Silente_401', displayName: 'Joaquín Silencio' },
  { alias: 'Nocturno_186', displayName: 'Martina Noche' },
  { alias: 'Fantasmal_290', displayName: 'Santiago Espectro' },
];

const MEMBERSHIPS: [alias: string, house: string, role: HouseRole][] = [
  ['Sombrio_042', 'darkness', 'head_haunter'],
  ['Errante_119', 'darkness', 'senior_spook'],
  ['Nebuloso_207', 'darkness', 'spirit'],
  ['Umbral_333', 'comedy', 'head_haunter'],
  ['Gelido_058', 'comedy', 'poltergeist'],
  ['Silente_401', 'terror', 'head_haunter'],
  ['Nocturno_186', 'terror', 'spirit'],
  ['Fantasmal_290', 'corporate', 'head_haunter'],
  ['Sombrio_042', 'corporate', 'senior_spook'],
  ['Errante_119', 'terror', 'poltergeist'],
];

const OBJECTS: {
  key: string;
  name: string;
  house: string;
  curse: string;
  minBid: number;
  maxBid: number;
}[] = [
  {
    key: 'espejo',
    name: 'Espejo sin Reflejo',
    house: 'darkness',
    curse: 'Eco del Silencio',
    minBid: 50,
    maxBid: 400,
  },
  {
    key: 'reloj',
    name: 'Reloj Detenido a Medianoche',
    house: 'darkness',
    curse: 'Sombra Persistente',
    minBid: 80,
    maxBid: 600,
  },
  {
    key: 'vela',
    name: 'Vela que Nunca se Apaga',
    house: 'darkness',
    curse: 'Niebla del Olvido',
    minBid: 30,
    maxBid: 250,
  },
  {
    key: 'mascara',
    name: 'Mascara de la Risa Eterna',
    house: 'comedy',
    curse: 'Susurro Nocturno',
    minBid: 20,
    maxBid: 180,
  },
  {
    key: 'sombrero',
    name: 'Sombrero de Copa Parlante',
    house: 'comedy',
    curse: 'Vinculo Roto',
    minBid: 40,
    maxBid: 220,
  },
  {
    key: 'muneca',
    name: 'Muneca de Porcelana Abandonada',
    house: 'terror',
    curse: 'Peso del Umbral',
    minBid: 100,
    maxBid: 900,
  },
  {
    key: 'cadena',
    name: 'Cadena Oxidada del Sotano',
    house: 'terror',
    curse: 'Cadena Espectral',
    minBid: 60,
    maxBid: 500,
  },
  {
    key: 'retrato',
    name: 'Retrato de Ojos que Siguen',
    house: 'terror',
    curse: 'Marca del Errante',
    minBid: 90,
    maxBid: 700,
  },
  {
    key: 'grapadora',
    name: 'Grapadora del Piso 13',
    house: 'corporate',
    curse: 'Vinculo Roto',
    minBid: 15,
    maxBid: 120,
  },
  {
    key: 'taza',
    name: 'Taza de Cafe Siempre Tibio',
    house: 'corporate',
    curse: 'Niebla del Olvido',
    minBid: 10,
    maxBid: 90,
  },
];

interface AuctionSeed {
  object: string;
  status: AuctionStatus;
  opensAt: Date;
  closesAt: Date;
  /** Solo para cerradas/canceladas: cuándo se resolvió. */
  resolvedAt?: Date;
  bids: [alias: string, amount: number][];
  bets: [bettor: string, target: string, chips: SideBetChips][];
}

// Las pujas de las subastas resueltas reproducen los ejemplos del frontend
// (auction-4, auction-5, auction-6) y la regla de puja única más baja de REGLAS.md §2.
const AUCTIONS: AuctionSeed[] = [
  {
    object: 'grapadora',
    status: 'scheduled',
    opensAt: at(24),
    closesAt: at(72),
    bids: [],
    bets: [],
  },
  {
    object: 'espejo',
    status: 'open',
    opensAt: at(-24),
    closesAt: at(48),
    bids: [
      ['Errante_119', 120],
      ['Nebuloso_207', 95],
      ['Gelido_058', 200],
    ],
    bets: [
      ['Sombrio_042', 'Nebuloso_207', 10],
      ['Umbral_333', 'Errante_119', 5],
    ],
  },
  {
    object: 'mascara',
    status: 'open',
    opensAt: at(-12),
    closesAt: at(24),
    bids: [
      ['Sombrio_042', 60],
      ['Silente_401', 45],
    ],
    bets: [['Fantasmal_290', 'Silente_401', 25]],
  },
  {
    // 310 duplicado → gana 180 (Nocturno_186).
    object: 'cadena',
    status: 'closed',
    opensAt: at(-120),
    closesAt: at(-72),
    resolvedAt: at(-72),
    bids: [
      ['Silente_401', 310],
      ['Nocturno_186', 180],
      ['Errante_119', 310],
    ],
    bets: [
      ['Sombrio_042', 'Nocturno_186', 10],
      ['Nebuloso_207', 'Silente_401', 5],
    ],
  },
  {
    // 250 duplicado → gana 199 (Fantasmal_290).
    object: 'reloj',
    status: 'closed',
    opensAt: at(-72),
    closesAt: at(-24),
    resolvedAt: at(-24),
    bids: [
      ['Sombrio_042', 250],
      ['Umbral_333', 250],
      ['Fantasmal_290', 199],
    ],
    bets: [
      ['Gelido_058', 'Fantasmal_290', 25],
      ['Nocturno_186', 'Sombrio_042', 5],
    ],
  },
  {
    // 40 y 55 duplicados → ningún monto único → cancelada (no_unique_bids).
    object: 'taza',
    status: 'cancelled',
    opensAt: at(-30),
    closesAt: at(-6),
    resolvedAt: at(-6),
    bids: [
      ['Nocturno_186', 40],
      ['Nebuloso_207', 40],
      ['Gelido_058', 55],
      ['Sombrio_042', 55],
    ],
    bets: [['Errante_119', 'Gelido_058', 10]],
  },
];

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Seed inconsistente: no existe ${what}`);
  return value;
}

/** Resolución de REGLAS.md §2 aplicada a los datos del seed. */
function resolve(bids: [string, number][]) {
  const counts = new Map<number, number>();
  for (const [, amount] of bids) counts.set(amount, (counts.get(amount) ?? 0) + 1);
  const unique = bids.filter(([, amount]) => counts.get(amount) === 1);
  const winner = unique.sort((a, b) => a[1] - b[1])[0];
  const duplicates = bids.filter(([, amount]) => (counts.get(amount) ?? 0) > 1).map(([a]) => a);
  const cancellationReason: CancellationReason | undefined =
    bids.length === 0 ? 'no_bids' : winner ? undefined : 'no_unique_bids';
  return { winner, duplicates, cancellationReason };
}

async function seed(): Promise<void> {
  if (env.isProduction && !process.argv.includes('--force')) {
    console.error(
      '❌ NODE_ENV=production: el seed BORRA todas las colecciones.\n' +
        '   Si de verdad querés correrlo contra esta base: npm run seed -- --force',
    );
    process.exit(1);
  }

  await connectDB();

  // Todos los modelos registrados al importar ../models/index.js.
  const models = Object.values(mongoose.models);
  await Promise.all(models.map((model) => model.deleteMany({})));
  // Asegura los índices únicos antes de insertar (el seed también los valida).
  await Promise.all(models.map((model) => model.syncIndexes()));

  // Curses
  const curses = await Curse.insertMany(CURSES);
  const curseByName = new Map(curses.map((c) => [c.name, c]));

  // Users — hasheo explícito, igual que auth.service. No hay hook pre('save') de
  // hashing a propósito: ver "Contraseñas" en CLAUDE.md.
  const [adminHash, userHash] = await Promise.all([
    bcrypt.hash(ADMIN.password, env.BCRYPT_ROUNDS),
    bcrypt.hash(USER_PASSWORD, env.BCRYPT_ROUNDS),
  ]);
  const admin = await User.create({
    email: ADMIN.email,
    passwordHash: adminHash,
    displayName: 'Administrador',
    alias: 'Espectral_001',
    role: 'admin',
  });

  // Ledger de reputación (REGLAS.md §1): todos arrancan con 100.
  const reputation = new Map(USERS.map((u) => [u.alias, 100]));
  const adjust = (alias: string, delta: number) =>
    reputation.set(alias, Math.max(0, must(reputation.get(alias), alias) + delta));

  const users = await User.insertMany(
    USERS.map((u) => ({
      ...u,
      email: `${u.alias.split('_')[0]!.toLowerCase()}@phantombids.dev`,
      passwordHash: userHash,
    })),
  );
  const userByAlias = new Map(users.map((u) => [u.alias, u]));
  const userId = (alias: string): Types.ObjectId =>
    must(userByAlias.get(alias), `usuario ${alias}`)._id;

  // Houses + memberships
  const houses = await HauntHouse.insertMany(
    HOUSES.map(({ key: _key, head, ...house }) => ({ ...house, createdBy: userId(head) })),
  );
  const houseByTheme = new Map(houses.map((h) => [h.theme as string, h]));
  const houseId = (key: string) => must(houseByTheme.get(key), `casa ${key}`)._id;
  const headOf = (key: string) =>
    must(
      HOUSES.find((h) => h.key === key),
      `casa ${key}`,
    ).head;

  await HouseMembership.insertMany(
    MEMBERSHIPS.map(([alias, house, houseRole]) => ({
      user: userId(alias),
      house: houseId(house),
      houseRole,
    })),
  );

  // Objects
  const objects = await CursedObject.insertMany(
    OBJECTS.map(({ key: _key, house, curse, ...object }) => ({
      ...object,
      house: houseId(house),
      curse: must(curseByName.get(curse), `maldición ${curse}`)._id,
      createdBy: userId(headOf(house)),
    })),
  );
  const objectByKey = new Map(OBJECTS.map((o, i) => [o.key, must(objects[i], o.key)]));

  // Auctions, bids, side bets, user curses
  let curseIndex = 0;
  for (const a of AUCTIONS) {
    const object = must(objectByKey.get(a.object), `objeto ${a.object}`);
    const resolved = a.status === 'closed' || a.status === 'cancelled';
    const outcome = resolve(a.bids);

    const house = must(
      OBJECTS.find((o) => o.key === a.object),
      a.object,
    ).house;
    const auction = await Auction.create({
      object: object._id,
      status: a.status,
      opensAt: a.opensAt,
      closesAt: a.closesAt,
      createdBy: userId(headOf(house)),
      ...(resolved && {
        resolvedAt: a.resolvedAt,
        // El seed aplica él mismo los efectos del cierre: quedan liquidadas.
        settledAt: a.resolvedAt,
        winner: outcome.winner ? userId(outcome.winner[0]) : undefined,
        winningBid: outcome.winner?.[1],
        cancellationReason: outcome.cancellationReason,
      }),
    });

    await Bid.insertMany(
      a.bids.map(([alias, amount]) => ({
        auction: auction._id,
        user: userId(alias),
        amount,
        isDuplicate: resolved && outcome.duplicates.includes(alias),
      })),
    );

    for (const [bettor, target, chips] of a.bets) {
      adjust(bettor, -chips);
      const won = resolved && outcome.winner?.[0] === target;
      if (won) adjust(bettor, chips * BET_MULTIPLIER);
      // SideBet.create (no insertMany) para que corra el validador bettor !== targetUser.
      await SideBet.create({
        auction: auction._id,
        bettor: userId(bettor),
        targetUser: userId(target),
        chips,
        result: resolved ? (won ? 'won' : 'lost') : 'pending',
        payout: won ? chips * BET_MULTIPLIER : 0,
      });
    }

    if (resolved) {
      for (const alias of outcome.duplicates) {
        adjust(alias, -DUPLICATE_PENALTY);
        // Rotación determinista por el catálogo para que el seed sea reproducible.
        const curse = must(curses[curseIndex++ % curses.length], 'maldición');
        const imposedAt = must(a.resolvedAt, 'resolvedAt');
        const expiresAt = new Date(imposedAt.getTime() + curse.durationHours * HOUR);
        await UserCurse.create({
          user: userId(alias),
          curse: curse._id,
          reason: 'Puja duplicada detectada al cerrar la subasta.',
          sourceAuction: auction._id,
          imposedAt,
          expiresAt,
          status: expiresAt.getTime() > now ? 'active' : 'expired',
        });
      }
    }
  }

  await User.bulkWrite(
    [...reputation].map(([alias, value]) => ({
      updateOne: { filter: { _id: userId(alias) }, update: { $set: { reputation: value } } },
    })),
  );

  // Resumen
  const counts = await Promise.all(
    models.map(
      async (model) => [model.collection.collectionName, await model.countDocuments()] as const,
    ),
  );
  console.log('\n🌱 Seed completado');
  console.table(Object.fromEntries(counts));
  console.log('Admin:    ', ADMIN.email, '/', ADMIN.password, `(alias ${admin.alias})`);
  console.log(
    'Usuarios: ',
    '<adjetivo>@phantombids.dev /',
    USER_PASSWORD,
    '(ej. sombrio@phantombids.dev)',
  );
}

seed()
  .catch((error: unknown) => {
    console.error('❌ El seed falló:', error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
