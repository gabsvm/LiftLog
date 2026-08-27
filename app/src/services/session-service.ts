import {
  KeyedExerciseBlueprint,
  SessionBlueprint,
  ExerciseBlueprint,
  CardioExerciseBlueprint,
} from '@/models/blueprint-models';
import { Weight, WeightUnit } from '@/models/weight';
import {
  EmptySession,
  PotentialSet,
  RecordedCardioExercise,
  RecordedCardioExerciseSet,
  RecordedExercise,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import type { RootState } from '@/store';
import {
  getSessionReferenceTime,
  selectLatestNonFreeformSession,
} from '@/store/stored-sessions';
import { KeyValueStore } from '@/services/key-value-store';
import { sessionsSchema } from '@/db/schema';
import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { uuid } from '@/utils/uuid';
import { LocalDate } from '@js-joda/core';
import { match } from 'ts-pattern';

const latestSessionStorageKey = 'LatestNonFreeformSessionV1';

export class SessionService {
  constructor(
    private keyValueStore: KeyValueStore,
    private db: ExpoSQLiteDatabase,
    private getState: () => RootState,
  ) {}

  async *getUpcomingSessions(
    sessionBlueprints: SessionBlueprint[],
    latestExercises: Record<string, RecordedExercise | undefined>,
  ): AsyncIterableIterator<Session> {
    const currentState = this.getState();
    const currentSession = currentState.currentSession.workoutSession;

    const firstSessionBlueprint = sessionBlueprints[0];
    if (!firstSessionBlueprint) {
      return;
    }
    await yieldToEventLoop();

    let latestSession =
      currentSession ??
      selectLatestNonFreeformSession(currentState) ??
      (await this.loadLatestCompletedSession());

    await yieldToEventLoop();
    if (!latestSession) {
      latestSession = this.createNewSession(
        firstSessionBlueprint,
        latestExercises,
      );
      yield latestSession;
    }

    while (true) {
      latestSession = this.getNextSession(
        latestSession,
        sessionBlueprints,
        latestExercises,
      );
      yield latestSession;
    }
  }

  async rememberCompletedSession(session: Session): Promise<void> {
    if (session.isFreeform) return;
    await this.keyValueStore.setItem(
      latestSessionStorageKey,
      JSON.stringify(session.toJSON()),
    );
  }

  async invalidateLatestCompletedSessionCache(): Promise<void> {
    await this.keyValueStore.removeItem(latestSessionStorageKey);
  }

  public hydrateSessionFromBlueprint(
    blueprint: SessionBlueprint,
    latestExercises: Record<string, RecordedExercise | undefined>,
  ): Session {
    return this.createNewSession(blueprint, latestExercises);
  }

  private async loadLatestCompletedSession(): Promise<Session | undefined> {
    const cached = await this.keyValueStore.getItem(latestSessionStorageKey);
    if (cached) {
      try {
        const session = Session.fromJSON(JSON.parse(cached));
        if (!session.isFreeform) return session;
      } catch {
        await this.keyValueStore.removeItem(latestSessionStorageKey);
      }
    }

    // Existing installs do this scan once. Future launches read a single small
    // KV snapshot and never need the historical object graph to choose the next
    // program session.
    const rows = await this.db
      .select({ payload: sessionsSchema.payload })
      .from(sessionsSchema);
    let latest: Session | undefined;
    for (const row of rows) {
      const session = Session.fromJSON(row.payload);
      if (session.isFreeform) continue;
      if (
        !latest ||
        getSessionReferenceTime(latest).isBefore(getSessionReferenceTime(session))
      ) {
        latest = session;
      }
    }
    if (latest) {
      await this.rememberCompletedSession(latest);
    }
    return latest;
  }

  private getNextSession(
    previousSession: Session,
    sessionBlueprints: SessionBlueprint[],
    latestRecordedExercises: Record<string, RecordedExercise | undefined>,
  ): Session {
    const lastBlueprint = previousSession.blueprint;
    const lastBlueprintIndex = sessionBlueprints.findIndex(
      (x) => x.name === lastBlueprint.name,
    );
    const nextBlueprint =
      sessionBlueprints[(lastBlueprintIndex + 1) % sessionBlueprints.length];
    if (!nextBlueprint) {
      return EmptySession.with({ id: uuid() });
    }

    return this.createNewSession(nextBlueprint, latestRecordedExercises).with({
      bodyweight: previousSession.bodyweight,
    });
  }

  private createNewSession(
    sessionBlueprint: SessionBlueprint,
    latestRecordedExercises: Record<string, RecordedExercise | undefined>,
  ): Session {
    const getNextExercise = (e: ExerciseBlueprint): RecordedExercise => {
      const lastExercise =
        latestRecordedExercises[
          KeyedExerciseBlueprint.fromExerciseBlueprint(e).toString()
        ];
      if (e instanceof CardioExerciseBlueprint) {
        const cardioLastExercise =
          lastExercise instanceof RecordedCardioExercise
            ? lastExercise
            : undefined;
        return RecordedCardioExercise.empty(e).with({
          sets: e.sets.map((s, i) =>
            RecordedCardioExerciseSet.empty(s).with({
              incline: cardioLastExercise?.sets[i]?.incline,
              resistance: cardioLastExercise?.sets[i]?.resistance,
            }),
          ),
        });
      }
      const weightedLastExercise =
        lastExercise instanceof RecordedWeightedExercise
          ? lastExercise
          : undefined;
      const potentialSets: PotentialSet[] = match(weightedLastExercise)
        .returnType<PotentialSet[]>()
        .with(undefined, () =>
          Array.from(
            { length: e.sets },
            () =>
              new PotentialSet(
                undefined,
                new Weight(0, this.getDefaultWeightUnit()),
              ),
          ),
        )
        .otherwise((x) =>
          x.potentialSets.map((set) => new PotentialSet(undefined, set.weight)),
        );
      let newExercise = new RecordedWeightedExercise(
        e,
        potentialSets,
        undefined,
      );
      if (weightedLastExercise?.isSuccessForProgressiveOverload) {
        newExercise =
          newExercise.blueprint.progressiveOverload.applyProgressiveOverload(
            newExercise,
          );
      }
      return newExercise;
    };

    return new Session(
      uuid(),
      sessionBlueprint,
      sessionBlueprint.exercises.map(getNextExercise),
      LocalDate.now(),
      undefined,
      undefined,
    );
  }

  private getDefaultWeightUnit(): WeightUnit {
    return this.getState().settings.useImperialUnits ? 'pounds' : 'kilograms';
  }
}

const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));
