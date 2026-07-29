import {
  NoProgressiveOverload,
  ProgramBlueprint,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { uuid } from '@/utils/uuid';
import { Duration, LocalDate } from '@js-joda/core';

type LocalizedText = string | { es?: string; en?: string };

type IronLogSlot = {
  exerciseId?: string;
  muscle?: string;
  setTarget?: number;
  reps?: string;
  supersetId?: string | null;
  notes?: string;
};

type IronLogExercise = {
  id: string;
  name?: LocalizedText;
  defaultRestSeconds?: number;
};

type IronLogDay = {
  dayName?: LocalizedText;
  notes?: string;
  slots?: IronLogSlot[];
};

export type IronLogCloudSnapshot = {
  activeMeso?: { name?: string | null } | null;
  program?: IronLogDay[];
  exercises?: IronLogExercise[];
};

const localize = (value: LocalizedText | undefined, fallback: string) =>
  typeof value === 'string' ? value : value?.es ?? value?.en ?? fallback;

const restFor = (seconds?: number) => {
  const base = Math.max(30, seconds ?? 90);
  return {
    minRest: Duration.ofSeconds(base),
    maxRest: Duration.ofSeconds(Math.round(base * 1.5)),
    failureRest: Duration.ofSeconds(Math.round(base * 2)),
  };
};

const targetReps = (reps?: string) => Number(reps?.match(/\d+/)?.[0] ?? 10);

/**
 * Turns the PWA snapshot into an editable LiftLog plan. Superset groups are
 * made consecutive because LiftLog's model links an exercise to the next one.
 */
export function importIronLogRoutine(snapshot: IronLogCloudSnapshot): ProgramBlueprint {
  const exerciseById = new Map((snapshot.exercises ?? []).map((exercise) => [exercise.id, exercise]));
  const sessions = (snapshot.program ?? []).map((day, dayIndex) => {
    const source = day.slots ?? [];
    const emittedSupersets = new Set<string>();
    const ordered = source.flatMap((slot) => {
      if (!slot.supersetId) return [slot];
      if (emittedSupersets.has(slot.supersetId)) return [];
      emittedSupersets.add(slot.supersetId);
      return source.filter((candidate) => candidate.supersetId === slot.supersetId);
    });

    const exercises = ordered.map((slot, index) => {
      const next = ordered[index + 1];
      const definition = slot.exerciseId ? exerciseById.get(slot.exerciseId) : undefined;
      return new WeightedExerciseBlueprint(
        localize(definition?.name, slot.exerciseId ?? slot.muscle ?? `Ejercicio ${index + 1}`),
        Math.max(1, slot.setTarget ?? 3),
        Math.max(1, targetReps(slot.reps)),
        new NoProgressiveOverload(),
        definition?.defaultRestSeconds ? restFor(definition.defaultRestSeconds) : Rest.medium,
        Boolean(slot.supersetId && slot.supersetId === next?.supersetId),
        slot.notes ?? '',
        '',
      );
    });
    return new SessionBlueprint(localize(day.dayName, `Dia ${dayIndex + 1}`), exercises, day.notes ?? '');
  });

  return new ProgramBlueprint(
    snapshot.activeMeso?.name?.trim() || 'Rutina importada de IronLog',
    sessions,
    LocalDate.now(),
  );
}

export function importIronLogSnapshotAsPlan(snapshot: IronLogCloudSnapshot) {
  return { [uuid()]: importIronLogRoutine(snapshot) };
}
