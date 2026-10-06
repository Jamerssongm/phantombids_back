import { Curse, type CurseDocument, type CurseSeverity } from '../models/Curse.js';
import { CursedObject } from '../models/CursedObject.js';
import { UserCurse } from '../models/UserCurse.js';
import { AppError } from '../utils/AppError.js';

export interface CurseInput {
  name: string;
  description: string;
  icon: string;
  durationHours: number;
  severity: CurseSeverity;
}

/** Escala de duración por severidad (docs/REGLAS.md §4). */
const DURATION_BY_SEVERITY: Record<CurseSeverity, { min: number; max: number }> = {
  minor: { min: 12, max: 24 },
  moderate: { min: 36, max: 48 },
  severe: { min: 72, max: 72 },
};

function assertDurationMatchesSeverity(durationHours: number, severity: CurseSeverity): void {
  const { min, max } = DURATION_BY_SEVERITY[severity];
  if (durationHours < min || durationHours > max) {
    const range = min === max ? `${min} horas` : `entre ${min} y ${max} horas`;
    const message = `Una maldición "${severity}" debe durar ${range} (recibido: ${durationHours})`;
    throw AppError.unprocessable(message, [
      { field: 'durationHours', value: durationHours, message },
    ]);
  }
}

export function listCurses(): Promise<CurseDocument[]> {
  return Curse.find().sort({ name: 1 });
}

export async function getCurse(id: string): Promise<CurseDocument> {
  const curse = await Curse.findById(id);
  if (!curse) throw AppError.notFound('La maldición no existe');
  return curse;
}

export async function createCurse(input: CurseInput): Promise<CurseDocument> {
  assertDurationMatchesSeverity(input.durationHours, input.severity);
  // Lista blanca explícita; name duplicado → E11000 → 409 en el errorHandler.
  return Curse.create({
    name: input.name,
    description: input.description,
    icon: input.icon,
    durationHours: input.durationHours,
    severity: input.severity,
  });
}

/**
 * Update con carga + save(): corren las validaciones del schema. La escala por
 * severidad se valida sobre el estado FINAL (campos nuevos + los que no cambian).
 */
export async function updateCurse(id: string, input: Partial<CurseInput>): Promise<CurseDocument> {
  const curse = await getCurse(id);
  if (input.name !== undefined) curse.name = input.name;
  if (input.description !== undefined) curse.description = input.description;
  if (input.icon !== undefined) curse.icon = input.icon;
  if (input.durationHours !== undefined) curse.durationHours = input.durationHours;
  if (input.severity !== undefined) curse.severity = input.severity;
  assertDurationMatchesSeverity(curse.durationHours, curse.severity);
  await curse.save();
  return curse;
}

/** Borrado físico, solo si nada la referencia: es catálogo, no historia. */
export async function deleteCurse(id: string): Promise<void> {
  const curse = await getCurse(id);
  const [assigned, objects] = await Promise.all([
    UserCurse.countDocuments({ curse: curse._id }),
    CursedObject.countDocuments({ curse: curse._id }),
  ]);
  if (assigned > 0 || objects > 0) {
    throw AppError.conflict(
      `La maldición está en uso (${objects} objeto(s), ${assigned} maldición(es) asignada(s)) y no se puede borrar`,
      [],
      'CURSE_IN_USE',
    );
  }
  await curse.deleteOne();
}
