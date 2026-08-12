import { describe, expect, it } from 'vitest';
import { importIronLogRoutine } from '@/services/ironlog-routine-importer';

describe('importIronLogRoutine', () => {
  it('keeps a non-adjacent IronLog superset together for LiftLog', () => {
    const plan = importIronLogRoutine({
      activeMeso: { name: 'Upper A' },
      exercises: [
        { id: 'press', name: { es: 'Press banca' } },
        { id: 'row', name: { es: 'Remo' } },
        { id: 'fly', name: { es: 'Aperturas' } },
      ],
      program: [{
        dayName: { es: 'Torso' },
        slots: [
          { exerciseId: 'press', setTarget: 4, reps: '6-8', supersetId: 'ss_1' },
          { exerciseId: 'row', setTarget: 3, reps: '8-12' },
          { exerciseId: 'fly', setTarget: 3, reps: '10-15', supersetId: 'ss_1' },
        ],
      }],
    });

    const exercises = plan.sessions[0]!.exercises;
    expect(plan.name).toBe('Upper A');
    expect(exercises.map((exercise) => exercise.name)).toEqual(['Press banca', 'Aperturas', 'Remo']);
    expect(exercises.map((exercise) => 'supersetWithNext' in exercise && exercise.supersetWithNext)).toEqual([true, false, false]);
  });
});
