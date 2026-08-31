import { OffsetDateTime } from '@js-joda/core';
import { WeightedExerciseBlueprint } from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedWeightedExercise,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import { describe, expect, it, vi } from 'vitest';
import { routeWeightedSetTap } from './weighted-set-tap-router';

const TIME = OffsetDateTime.parse('2026-08-31T15:00:00-03:00');

function exerciseFixture(): RecordedWeightedExercise {
  const blueprint = WeightedExerciseBlueprint.empty().with({
    name: 'Bench',
    sets: 2,
    repsPerSet: 8,
  });
  return new RecordedWeightedExercise(
    blueprint,
    [
      new PotentialSet(undefined, new Weight(80, 'kilograms')),
      new PotentialSet(undefined, new Weight(80, 'kilograms')),
    ],
    undefined,
  );
}

describe('weighted set tap router', () => {
  it('routes the tap only to native and returns its reconciled exercise snapshot', () => {
    const exercise = exerciseFixture();
    const nativeExercise = exercise.withCycledRepCount(0, TIME);
    const nativeCycle = vi.fn(() => nativeExercise);
    const commitExerciseUpdate = vi.fn();

    const interactionExercise = routeWeightedSetTap({
      index: 0,
      exercise,
      time: TIME,
      nativeCycle,
      commitExerciseUpdate,
    });

    expect(nativeCycle).toHaveBeenCalledTimes(1);
    expect(nativeCycle).toHaveBeenCalledWith(0, TIME);
    expect(commitExerciseUpdate).not.toHaveBeenCalled();
    expect(interactionExercise).toBe(nativeExercise);
  });

  it('preserves the existing RN writer and returns its optimistic snapshot', () => {
    const exercise = exerciseFixture();
    const commitExerciseUpdate = vi.fn();

    const interactionExercise = routeWeightedSetTap({
      index: 0,
      exercise,
      time: TIME,
      commitExerciseUpdate,
    });

    expect(commitExerciseUpdate).toHaveBeenCalledTimes(1);
    const [updatedExercise, options] = commitExerciseUpdate.mock.calls[0]!;
    expect(updatedExercise.getSet(0).set?.repsCompleted).toBe(8);
    expect(updatedExercise.getSet(0).set?.completionDateTime.equals(TIME)).toBe(
      true,
    );
    expect(options).toEqual({ resetTimer: true });
    expect(interactionExercise).toBe(updatedExercise);
  });
});
