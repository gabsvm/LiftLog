import {
  CardioExerciseBlueprint,
  ExerciseBlueprint,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  SessionJSON,
  fromLocalDateJSON,
  toLocalDateJSON,
} from '@/models/storage/versions/latest';
import { Weight, WeightUnit } from '@/models/weight';
import { Duration, LocalDate, OffsetDateTime } from '@js-joda/core';
import { match } from 'ts-pattern';
import { P } from 'ts-pattern';
import { uuid } from '@/utils/uuid';
import { equal } from '@/models/session-models/helpers';
import {
  RecordedCardioExercise,
  RecordedCardioExerciseSet,
} from '@/models/session-models/recorded-cardio-exercise';
import {
  RecordedExercise,
  createEmptyRecordedExercise,
  fromRecordedExerciseJSON,
} from '@/models/session-models/recorded-exercise';
import {
  PotentialSet,
  RecordedWeightedExercise,
} from '@/models/session-models/recorded-weighted-exercise';
import { IndexOutOfBoundsError } from '@/utils/index-out-of-bounds';

export class Session {
  constructor(
    readonly id: string,
    readonly blueprint: SessionBlueprint,
    readonly recordedExercises: RecordedExercise[],
    readonly date: LocalDate,
    readonly bodyweight: Weight | undefined,
    readonly restTimerStartTime: OffsetDateTime | undefined,
  ) {}

  get duration(): Duration | undefined {
    let firstExercise: RecordedExercise | undefined;
    let firstLatestTime: OffsetDateTime | undefined;
    let lastLatestTime: OffsetDateTime | undefined;

    for (const exercise of this.recordedExercises) {
      if (!exercise.isStarted || !exercise.latestTime) {
        continue;
      }

      if (!firstLatestTime || exercise.latestTime.isBefore(firstLatestTime)) {
        firstLatestTime = exercise.latestTime;
        firstExercise = exercise;
      }
      if (!lastLatestTime || exercise.latestTime.isAfter(lastLatestTime)) {
        lastLatestTime = exercise.latestTime;
      }
    }

    return firstExercise?.earliestTime && lastLatestTime
      ? Duration.between(firstExercise.earliestTime, lastLatestTime)
      : undefined;
  }

  static fromJSON(json: SessionJSON): Session {
    return new Session(
      json.id,
      SessionBlueprint.fromJSON({
        ...json.blueprint,
        version: 2,
        exercises: json.recordedExercises.map((x) => x.blueprint),
      }),
      json.recordedExercises.map(fromRecordedExerciseJSON),
      fromLocalDateJSON(json.date),
      json.bodyweight ? Weight.fromJSON(json.bodyweight) : undefined,
      undefined,
    );
  }

  static getEmptySession(
    blueprint: SessionBlueprint,
    defaultWeightUnit: WeightUnit,
  ): Session {
    function getNextExercise(e: ExerciseBlueprint) {
      return match(e)
        .with(
          P.instanceOf(WeightedExerciseBlueprint),
          (we) =>
            new RecordedWeightedExercise(
              we,
              Array.from({ length: we.sets }).map(
                () =>
                  new PotentialSet(undefined, new Weight(0, defaultWeightUnit)),
              ),
              undefined,
            ),
        )
        .with(P.instanceOf(CardioExerciseBlueprint), (ce) =>
          RecordedCardioExercise.empty(ce),
        )
        .exhaustive();
    }
    return new Session(
      uuid(),
      blueprint,
      blueprint.exercises.map(getNextExercise),
      LocalDate.now(),
      undefined,
      undefined,
    );
  }

  withNoNilWeights(fallbackWeightUnit: WeightUnit): Session | undefined {
    return this.with({
      recordedExercises: this.recordedExercises.map((re) =>
        re instanceof RecordedWeightedExercise
          ? re.with({
              potentialSets: re.potentialSets.map((ps) =>
                ps.with({
                  weight: ps.weight.with({
                    unit:
                      ps.weight.unit === 'nil'
                        ? fallbackWeightUnit
                        : ps.weight.unit,
                  }),
                }),
              ),
            })
          : re,
      ),
    });
  }

  equals(other: Session | undefined): boolean {
    if (!other) {
      return false;
    }

    return (
      this.id === other.id &&
      this.date.equals(other.date) &&
      equal(this.bodyweight, other.bodyweight) &&
      this.blueprint.equals(other.blueprint) &&
      this.recordedExercises.length === other.recordedExercises.length &&
      this.recordedExercises.every((exercise, index) =>
        exercise.equals(other.recordedExercises[index]),
      )
    );
  }

  with(other: Partial<Session>) {
    return new Session(
      'id' in other ? (other.id ?? this.id) : this.id,
      'blueprint' in other
        ? (other.blueprint ?? this.blueprint)
        : this.blueprint,
      'recordedExercises' in other
        ? (other.recordedExercises ?? this.recordedExercises)
        : this.recordedExercises,
      'date' in other ? (other.date ?? this.date) : this.date,
      'bodyweight' in other ? other.bodyweight : this.bodyweight,
      'restTimerStartTime' in other
        ? other.restTimerStartTime
        : this.restTimerStartTime,
    );
  }

  withEditedExercise(
    exerciseIndex: number,
    newBlueprint: ExerciseBlueprint,
    useImperialUnits: boolean,
  ): Session {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let session: Session = this;
    const existingExercise = session.recordedExercises[exerciseIndex];
    if (!existingExercise) {
      throw new IndexOutOfBoundsError(exerciseIndex, session.recordedExercises);
    }

    session = session.with({
      blueprint: session.blueprint.with({
        exercises: session.blueprint.exercises.with(
          exerciseIndex,
          newBlueprint,
        ),
      }),
    });
    if (existingExercise.blueprint.type !== newBlueprint.type) {
      session = session.withExercise(
        exerciseIndex,
        createEmptyRecordedExercise(
          newBlueprint,
          useImperialUnits ? 'pounds' : 'kilograms',
        ),
      );
    } else {
      const weightedExistingExercise =
        session.recordedExercises[exerciseIndex]!.type ===
        'RecordedWeightedExercise'
          ? session.recordedExercises[exerciseIndex]
          : undefined;
      if (weightedExistingExercise) {
        session = session.withExercise(
          exerciseIndex,
          weightedExistingExercise.with({
            blueprint: newBlueprint as WeightedExerciseBlueprint,
            potentialSets: Array.from(
              { length: (newBlueprint as WeightedExerciseBlueprint).sets },
              (_, index) =>
                weightedExistingExercise.potentialSets.at(index) ??
                new PotentialSet(
                  undefined,
                  weightedExistingExercise.maxWeight,
                ),
            ),
          }),
        );
      }

      const cardioExistingExercise =
        session.recordedExercises[exerciseIndex]!.type ===
        'RecordedCardioExercise'
          ? session.recordedExercises[exerciseIndex]
          : undefined;

      if (cardioExistingExercise) {
        session = session.withExercise(
          exerciseIndex,
          cardioExistingExercise.with({
            blueprint: newBlueprint as CardioExerciseBlueprint,
            sets: (newBlueprint as CardioExerciseBlueprint).sets.map((set, i) =>
              RecordedCardioExerciseSet.empty(set).with({
                // Basically allows us to use values from set, even if there are more sets now and it would be undefined
                ...cardioExistingExercise.sets[i],
                blueprint: set,
              }),
            ),
          }),
        );
      }
    }
    return session;
  }

  withAddedExercise(
    exercise: ExerciseBlueprint,
    useImperialUnits: boolean,
  ): Session {
    return this.with({
      blueprint: this.blueprint.with({
        exercises: this.blueprint.exercises.concat(exercise),
      }),
      recordedExercises: this.recordedExercises.concat(
        createEmptyRecordedExercise(
          exercise,
          useImperialUnits ? 'pounds' : 'kilograms',
        ),
      ),
    });
  }

  withUpdatedDate(date: LocalDate): Session {
    const originalDate = this.date;
    const newDate = date;

    // Gather all unique, non-null completion dates from all sets
    const allCompletionDates = this.recordedExercises
      .flatMap((re) =>
        re.type === 'RecordedWeightedExercise'
          ? re.potentialSets.map((ps) =>
              ps.set?.completionDateTime?.toLocalDate(),
            )
          : re.sets.map((s) => s.completionDateTime?.toLocalDate()),
      )
      .filter((d): d is LocalDate => d !== undefined);

    // If all sets have the same completion date, use absolute date
    const useAbsoluteDate =
      allCompletionDates.length > 0 &&
      new Set(allCompletionDates.map((d) => d.toString())).size === 1;

    function getAdjustedDate(setDate: LocalDate): LocalDate {
      if (useAbsoluteDate) {
        return newDate;
      }
      // Maintain relative offset if sets cross midnight
      const dayOffset = setDate.toEpochDay() - originalDate.toEpochDay();
      return newDate.plusDays(dayOffset);
    }

    // Update all sets' completionDateTime
    const newExercises = this.recordedExercises.map((re) => {
      if (re.type === 'RecordedWeightedExercise') {
        return re.withAllSets((ps) => {
          if (ps.set && ps.set.completionDateTime) {
            const setDate = ps.set.completionDateTime.toLocalDate();
            return ps.with({
              set: ps.set.with({
                completionDateTime: ps.set.completionDateTime
                  .toLocalTime()
                  .atDate(getAdjustedDate(setDate))
                  .atOffset(ps.set.completionDateTime.offset()),
              }),
            });
          }
          return ps;
        });
      } else {
        return re.withAllSets((set) => {
          if (set && set.completionDateTime) {
            const setDate = set.completionDateTime.toLocalDate();
            return set.with({
              completionDateTime: set.completionDateTime
                .toLocalTime()
                .atDate(getAdjustedDate(setDate))
                .atOffset(set.completionDateTime.offset()),
            });
          }
          return set;
        });
      }
    });

    return this.with({
      recordedExercises: newExercises,
      date,
    });
  }

  withNothingCompleted(): Session {
    return this.with({
      recordedExercises: this.recordedExercises.map((re) =>
        re.withNothingCompleted(),
      ),
    });
  }

  // TODO we should update the rest timer time when we call this
  withCycledExerciseReps(
    exerciseIndex: number,
    setIndex: number,
    time: OffsetDateTime,
  ): Session {
    const weightedRecorded = this.recordedExercises[exerciseIndex];
    if (!weightedRecorded) {
      throw new IndexOutOfBoundsError(exerciseIndex, this.recordedExercises);
    }
    if (weightedRecorded.type !== 'RecordedWeightedExercise') {
      return this;
    }
    let newDate = this.date;
    if (!this.isStarted) {
      newDate = time.toLocalDate();
    }
    return this.with({
      date: newDate,
      recordedExercises: this.recordedExercises.with(
        exerciseIndex,
        weightedRecorded.withCycledRepCount(setIndex, time),
      ),
    });
  }

  withExercise(exerciseIndex: number, exercise: RecordedExercise): Session {
    return this.with({
      recordedExercises: this.recordedExercises.with(exerciseIndex, exercise),
      blueprint: this.blueprint.with({
        exercises: this.blueprint.exercises.with(
          exerciseIndex,
          exercise.blueprint,
        ),
      }),
    });
  }

  withRemovedExercise(exerciseIndex: number): Session {
    return this.with({
      recordedExercises: this.recordedExercises.toSpliced(exerciseIndex, 1),
      blueprint: this.blueprint.with({
        exercises: this.blueprint.exercises.toSpliced(exerciseIndex, 1),
      }),
    });
  }

  toJSON(): SessionJSON {
    return {
      version: 2,
      blueprint: this.blueprint.toJSON(),
      bodyweight: this.bodyweight?.toJSON(),
      date: toLocalDateJSON(this.date),
      id: this.id,
      recordedExercises: this.recordedExercises.map((x) => x.toJSON()),
    };
  }

  static freeformSession(
    date: LocalDate,
    bodyweight: Weight | undefined,
  ): Session {
    return EmptySession.with({
      id: uuid(),
      date: date,
      bodyweight,
      blueprint: EmptySession.blueprint.with({ name: 'Freeform Workout' }),
    });
  }

  get totalWeightLifted(): Weight {
    let total = Weight.NIL;
    for (const exercise of this.recordedExercises) {
      if (!(exercise instanceof RecordedWeightedExercise)) {
        continue;
      }
      for (const potentialSet of exercise.potentialSets) {
        const repsCompleted = potentialSet.set?.repsCompleted ?? 0;
        if (repsCompleted !== 0) {
          total = total.plus(
            potentialSet.weight.multipliedBy(repsCompleted),
          );
        }
      }
    }
    return total;
  }

  get isComplete() {
    return this.recordedExercises.every((x) => x.isComplete);
  }

  get isStarted(): boolean {
    return this.recordedExercises.some((x) => x.isStarted);
  }

  get nextExercise(): RecordedExercise | undefined {
    const recordedExercises = this.recordedExercises;
    const cardioExerciseWithRunningTimer = recordedExercises.find(
      (x) =>
        x instanceof RecordedCardioExercise &&
        x.sets.some((s) => s.currentBlockStartTime),
    );
    if (cardioExerciseWithRunningTimer) {
      return cardioExerciseWithRunningTimer;
    }

    let latestExerciseIndex = -1;
    let latestExerciseTime: OffsetDateTime | undefined;
    for (let index = 0; index < recordedExercises.length; index++) {
      const exercise = recordedExercises[index]!;
      if (!exercise.isStarted) {
        continue;
      }
      const latestTime = exercise.latestTime;
      if (
        latestExerciseIndex === -1 ||
        (latestTime &&
          (!latestExerciseTime || latestTime.isAfter(latestExerciseTime)))
      ) {
        latestExerciseIndex = index;
        latestExerciseTime = latestTime;
      }
    }

    const latestExerciseSupersetsWithNext = match(latestExerciseIndex)
      .with(-1, () => false)
      .with(recordedExercises.length - 1, () => false) // can never superset with next if its the last exercise
      .otherwise(
        (i) =>
          recordedExercises[i] instanceof RecordedWeightedExercise &&
          recordedExercises[i].blueprint.supersetWithNext,
      );

    const latestExerciseSupersetsWithPrevious = match(latestExerciseIndex)
      .with(P.union(-1, 0), () => false)
      .otherwise((i) => {
        const prevIndex = i - 1;
        return (
          recordedExercises[prevIndex] instanceof RecordedWeightedExercise &&
          recordedExercises[prevIndex].blueprint.supersetWithNext
        );
      });

    if (
      latestExerciseSupersetsWithNext &&
      !recordedExercises[latestExerciseIndex + 1]?.isComplete
    ) {
      return recordedExercises[latestExerciseIndex + 1];
    }

    // loop back to the original exercise in the case of a superset chain
    if (latestExerciseSupersetsWithPrevious) {
      let indexToJumpBackTo = latestExerciseIndex - 1;
      while (
        indexToJumpBackTo >= 0 &&
        recordedExercises[indexToJumpBackTo] instanceof
          RecordedWeightedExercise &&
        (
          recordedExercises[indexToJumpBackTo]!
            .blueprint as WeightedExerciseBlueprint
        ).supersetWithNext
      ) {
        indexToJumpBackTo--;
      }
      // We are now at an exercise which is not supersetting with the next,
      // so jump forward to the next exercise
      indexToJumpBackTo++;
      // Now jump to the first exercise which has remaining sets in the chain
      while (
        indexToJumpBackTo < recordedExercises.length &&
        recordedExercises[indexToJumpBackTo]!.isComplete
      ) {
        indexToJumpBackTo++;
      }

      if (indexToJumpBackTo < recordedExercises.length) {
        return recordedExercises[indexToJumpBackTo];
      }
    }

    let result: RecordedExercise | undefined = undefined;
    let maxEpochSecond = Number.MIN_VALUE;

    for (const recordedExercise of recordedExercises) {
      if (!recordedExercise.isComplete) {
        const latestTime = recordedExercise.latestTime;
        const epochSecond = latestTime?.toEpochSecond() ?? Number.MIN_VALUE;

        if (epochSecond > maxEpochSecond || !result) {
          maxEpochSecond = epochSecond;
          result = recordedExercise;
        }
      }
    }
    return result;
  }

  get restTimerEndTime(): OffsetDateTime | undefined {
    if (!this.restTimerStartTime) {
      return undefined;
    }
    const exercise = this.lastExercise;
    const nextExercise = this.nextExercise;
    if (
      nextExercise &&
      exercise &&
      exercise.latestTime &&
      exercise instanceof RecordedWeightedExercise
    ) {
      const repsPerSet = exercise.blueprint.repsPerSet;
      const { minRest, failureRest } = exercise.blueprint.restBetweenSets;

      const rest = match(exercise.lastRecordedSet)
        .with(
          { set: { repsCompleted: P.when((x) => x >= repsPerSet) } },
          () => minRest,
        )
        .with(
          { set: { repsCompleted: P.when((x) => x < repsPerSet) } },
          () => failureRest,
        )
        .otherwise(() => Duration.ZERO);

      if (rest.equals(Duration.ZERO)) {
        return undefined;
      }
      return this.restTimerStartTime.plus(rest);
    }
  }

  get lastExercise(): RecordedExercise | undefined {
    let latestExercise: RecordedExercise | undefined;
    let latestTime: OffsetDateTime | undefined;

    for (const exercise of this.recordedExercises) {
      if (!exercise.isStarted || !exercise.latestTime) {
        continue;
      }
      if (!latestTime || exercise.latestTime.isAfter(latestTime)) {
        latestExercise = exercise;
        latestTime = exercise.latestTime;
      }
    }
    return latestExercise;
  }

  get latestWeightedExercise(): RecordedWeightedExercise | undefined {
    let latestExercise: RecordedWeightedExercise | undefined;
    let latestTime: OffsetDateTime | undefined;

    for (const exercise of this.recordedExercises) {
      if (
        !exercise.isStarted ||
        !(exercise instanceof RecordedWeightedExercise) ||
        !exercise.latestTime
      ) {
        continue;
      }
      if (!latestTime || exercise.latestTime.isAfter(latestTime)) {
        latestExercise = exercise;
        latestTime = exercise.latestTime;
      }
    }
    return latestExercise;
  }

  get firstExercise(): RecordedExercise | undefined {
    let firstExercise: RecordedExercise | undefined;
    let earliestLatestTime: OffsetDateTime | undefined;

    for (const exercise of this.recordedExercises) {
      if (!exercise.isStarted || !exercise.latestTime) {
        continue;
      }
      if (
        !earliestLatestTime ||
        exercise.latestTime.isBefore(earliestLatestTime)
      ) {
        firstExercise = exercise;
        earliestLatestTime = exercise.latestTime;
      }
    }
    return firstExercise;
  }

  get isFreeform(): boolean {
    return this.blueprint.name === 'Freeform Workout';
  }
}

export const EmptySession: Session = new Session(
  '00000000-0000-0000-0000-000000000000',
  new SessionBlueprint('', [], ''),
  [],
  LocalDate.MIN,
  undefined,
  undefined,
);
