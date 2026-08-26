import { WeightedExerciseBlueprint } from '@/models/blueprint-models';
import { RecordedExercise } from '@/models/session-models/recorded-exercise';

import {
  PotentialSetJSON,
  RecordedSetJSON,
  RecordedWeightedExerciseJSON,
  fromOffsetDateTimeJSON,
  toOffsetDateTimeJSON,
} from '@/models/storage/versions/latest';
import { Weight, WeightUnit } from '@/models/weight';
import { IndexOutOfBoundsError } from '@/utils/index-out-of-bounds';
import { Duration, OffsetDateTime } from '@js-joda/core';
import { match } from 'ts-pattern';

export type WeightAppliesTo = 'thisSet' | 'uncompletedSets' | 'allSets';
export class RecordedWeightedExercise {
  readonly type = 'RecordedWeightedExercise';

  constructor(
    readonly blueprint: WeightedExerciseBlueprint,
    readonly potentialSets: PotentialSet[],
    readonly notes: string | undefined,
  ) {}

  static fromJSON(
    json: RecordedWeightedExerciseJSON,
  ): RecordedWeightedExercise {
    return new RecordedWeightedExercise(
      WeightedExerciseBlueprint.fromJSON(json.blueprint),
      json.potentialSets.map((x) => PotentialSet.fromJSON(x)),
      json.notes,
    );
  }

  static empty(
    b: WeightedExerciseBlueprint,
    unit: WeightUnit,
  ): RecordedWeightedExercise {
    return new RecordedWeightedExercise(
      b,
      Array.from(
        { length: b.sets },
        () => new PotentialSet(undefined, new Weight(0, unit)),
      ),
      undefined,
    );
  }

  getSet(index: number): PotentialSet {
    const set = this.potentialSets[index];
    if (!set) {
      throw new IndexOutOfBoundsError(index, this.potentialSets);
    }
    return set;
  }

  equals(other: RecordedExercise | undefined) {
    if (!other) {
      return false;
    }
    if (other === this) {
      return true;
    }
    if (other.type !== this.type) {
      return false;
    }

    return (
      this.blueprint.equals(other.blueprint) &&
      this.notes === other.notes &&
      this.potentialSets.length === other.potentialSets.length &&
      this.potentialSets.every((set, index) => {
        const otherSet = other.potentialSets[index];
        return set.equals(otherSet);
      })
    );
  }

  with(other: Partial<RecordedWeightedExercise>) {
    return new RecordedWeightedExercise(
      'blueprint' in other
        ? (other.blueprint ?? this.blueprint)
        : this.blueprint,
      'potentialSets' in other
        ? (other.potentialSets ?? this.potentialSets)
        : this.potentialSets,
      'notes' in other ? other.notes : this.notes,
    );
  }

  withNothingCompleted(): RecordedWeightedExercise {
    return this.with({
      notes: undefined,
      potentialSets: this.potentialSets.map((ps) =>
        ps.with({ set: undefined }),
      ),
    });
  }

  withCycledRepCount(
    setIndex: number,
    time: OffsetDateTime,
  ): RecordedWeightedExercise {
    return this.withSet(setIndex, (s) =>
      s.with({
        set: match(s.set)
          .returnType<RecordedSet | undefined>()
          .with(
            undefined,
            () => new RecordedSet(this.blueprint.repsPerSet, time),
          )
          .with({ repsCompleted: 0 }, () => undefined)
          .otherwise((x) =>
            x.with({
              repsCompleted: x.repsCompleted - 1,
            }),
          ),
      }),
    );
  }

  withRepCount(
    setIndex: number,
    reps: number | undefined,
    time: OffsetDateTime,
  ): RecordedWeightedExercise {
    return this.withSet(setIndex, (s) =>
      s.with({
        set: reps === undefined ? undefined : new RecordedSet(reps, time),
      }),
    );
  }

  withSet(setIndex: number, reducer: (s: PotentialSet) => PotentialSet) {
    const existingSet = this.potentialSets[setIndex];
    if (!existingSet) {
      throw new IndexOutOfBoundsError(setIndex, this.potentialSets);
    }
    return this.with({
      potentialSets: this.potentialSets.with(setIndex, reducer(existingSet)),
    });
  }

  withAllSets(reducer: (s: PotentialSet) => PotentialSet) {
    return this.with({
      potentialSets: this.potentialSets.map(reducer),
    });
  }

  withWeight(setIndex: number, weight: Weight, applyTo: WeightAppliesTo) {
    return match(applyTo)
      .with('thisSet', () => this.withSet(setIndex, (s) => s.with({ weight })))
      .with('uncompletedSets', () =>
        this.withAllSets((s) => s.with({ weight: s.set ? s.weight : weight })),
      )
      .with('allSets', () => this.withAllSets((s) => s.with({ weight })))
      .exhaustive();
  }

  toJSON(): RecordedWeightedExerciseJSON {
    return {
      type: 'RecordedWeightedExercise',
      blueprint: this.blueprint.toJSON(),
      potentialSets: this.potentialSets.map((x) => x.toJSON()),
      notes: this.notes,
    };
  }

  get maxWeight(): Weight {
    let max: Weight | undefined;
    for (const set of this.potentialSets) {
      if (!max || set.weight.isGreaterThan(max)) {
        max = set.weight;
      }
    }
    return max ?? new Weight(0, 'kilograms');
  }

  get totalWeightLifted(): Weight {
    let total = Weight.NIL;
    for (const set of this.potentialSets) {
      const reps = set.set?.repsCompleted ?? 0;
      if (reps !== 0) {
        total = total.plus(set.weight.multipliedBy(reps));
      }
    }
    return total;
  }

  get currentSetIndex() {
    return this.potentialSets.findIndex((x) => !x.set);
  }

  get isStarted() {
    return !!this.firstRecordedSet;
  }

  get duration(): Duration | undefined {
    const earliestTime = this.earliestTime;
    const latestTime = this.latestTime;
    return earliestTime && latestTime
      ? Duration.between(earliestTime, latestTime)
      : undefined;
  }

  get latestTime(): OffsetDateTime | undefined {
    return this.lastRecordedSet?.set?.completionDateTime;
  }

  get earliestTime(): OffsetDateTime | undefined {
    return this.firstRecordedSet?.set?.completionDateTime;
  }

  get lastRecordedSet(): PotentialSet | undefined {
    let latest: PotentialSet | undefined;
    let latestTime: OffsetDateTime | undefined;
    for (const potentialSet of this.potentialSets) {
      const completionDateTime = potentialSet.set?.completionDateTime;
      if (
        completionDateTime &&
        (!latestTime || completionDateTime.isAfter(latestTime))
      ) {
        latest = potentialSet;
        latestTime = completionDateTime;
      }
    }
    return latest;
  }

  get firstRecordedSet(): PotentialSet | undefined {
    let earliest: PotentialSet | undefined;
    let earliestTime: OffsetDateTime | undefined;
    for (const potentialSet of this.potentialSets) {
      const completionDateTime = potentialSet.set?.completionDateTime;
      if (
        completionDateTime &&
        (!earliestTime || completionDateTime.isBefore(earliestTime))
      ) {
        earliest = potentialSet;
        earliestTime = completionDateTime;
      }
    }
    return earliest;
  }

  get isComplete(): boolean {
    return !this.potentialSets.some((x) => x.set === undefined);
  }

  /// <summary>
  /// An exercise is considered a success if ALL sets are successful
  /// </summary>
  get isSuccessForProgressiveOverload(): boolean {
    return this.potentialSets.every(
      (x) => x.set && x.set.repsCompleted >= this.blueprint.repsPerSet,
    );
  }
}

export class RecordedSet {
  constructor(
    readonly repsCompleted: number,
    readonly completionDateTime: OffsetDateTime,
  ) {}

  static fromJSON(json: RecordedSetJSON): RecordedSet {
    return new RecordedSet(
      json.repsCompleted,
      fromOffsetDateTimeJSON(json.completionDateTime),
    );
  }

  equals(other: RecordedSet | undefined): boolean {
    if (!other) {
      return false;
    }
    if (other === this) {
      return true;
    }
    return (
      this.repsCompleted === other.repsCompleted &&
      this.completionDateTime.equals(other.completionDateTime)
    );
  }

  with(other: Partial<RecordedSet>): RecordedSet {
    return new RecordedSet(
      'repsCompleted' in other ? other.repsCompleted! : this.repsCompleted,
      'completionDateTime' in other
        ? other.completionDateTime!
        : this.completionDateTime,
    );
  }

  toJSON(): RecordedSetJSON {
    return {
      repsCompleted: this.repsCompleted,
      completionDateTime: toOffsetDateTimeJSON(this.completionDateTime),
    };
  }
}

export class PotentialSet {
  readonly type = 'PotentialSet';
  constructor(
    readonly set: RecordedSet | undefined,
    readonly weight: Weight,
  ) {}

  static fromJSON(json: PotentialSetJSON): PotentialSet {
    return new PotentialSet(
      json.set ? RecordedSet.fromJSON(json.set) : undefined,
      Weight.fromJSON(json.weight),
    );
  }

  equals(other: PotentialSet | undefined): boolean {
    if (!other) {
      return false;
    }
    if (other === this) {
      return true;
    }
    return (
      (this.set?.equals(other.set) ?? other.set === undefined) &&
      this.weight.equals(other.weight)
    );
  }

  with(other: Partial<PotentialSet>): PotentialSet {
    return new PotentialSet(
      'set' in other ? other.set : this.set,
      'weight' in other ? other.weight! : this.weight,
    );
  }

  toJSON(): PotentialSetJSON {
    return {
      set: this.set?.toJSON(),
      weight: this.weight.toJSON(),
    };
  }
}
