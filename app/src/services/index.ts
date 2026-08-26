import { AiChatService } from '@/services/ai-chat-service';
import { EncryptionService } from '@/services/encryption-service';
import { FeedApiService } from '@/services/feed-api';
import { FeedFollowService } from '@/services/feed-follow-service';
import { FeedIdentityService } from '@/services/feed-identity-service';
import { FeedInboxDecryptionService } from '@/services/feed-inbox-decryption-service';
import { FileExportService } from '@/services/file-export-service';
import { FilePickerService } from '@/services/file-picker-service';
import { HubConnectionFactory } from '@/services/hub-connection-factory';
import { KeyValueStore } from '@/services/key-value-store';
import { Logger } from '@/services/logger';
import { NotificationService } from '@/services/notification-service';
import { PreferenceService } from '@/services/preference-service';
import { ProgressRepository } from '@/services/progress-repository';
import { SessionService } from '@/services/session-service';
import { StringSharer } from '@/services/string-sharer';
import { getTolgee } from '@/services/tolgee';
import { WorkoutWorker } from '@/services/workout-worker';
import { RootState } from '@/store';
import { Store } from '@reduxjs/toolkit';
import { HealthExportService } from './health-export-service';
import { HealthExportService as HES } from './health-export-service-shared';
import { DatabaseMigrationService } from './database-migration-service';
import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseImportService } from '@/services/database-import-service';

export type Services = ReturnType<typeof resolveServicesInternal>;

let resolvedServices: Services | undefined;

function resolveServicesInternal(
  store: Store<RootState>,
  db: ExpoSQLiteDatabase,
  expoDb: SQLiteDatabase,
) {
  if (!store) {
    throw new Error('Tried to resolve services without store');
  }

  // Keep the small services used by startup and every workout eager. Everything
  // feature-specific is exposed through a getter so constructing the service
  // container does not initialize crypto, Feed, AI, Health, or file APIs.
  const logger = new Logger();
  const keyValueStore = new KeyValueStore();
  const progressRepository = new ProgressRepository(store.getState);
  const sessionService = new SessionService(progressRepository, store.getState);
  const preferenceService = new PreferenceService(keyValueStore);
  const tolgee = getTolgee(preferenceService);
  const workoutWorkerService = new WorkoutWorker(
    store.dispatch,
    store.getState,
    tolgee,
  );
  const databaseMigrationService = new DatabaseMigrationService(
    db,
    logger,
    new DatabaseImportService(db, keyValueStore, preferenceService),
  );

  let notificationService: NotificationService | undefined;
  let encryptionService: EncryptionService | undefined;
  let feedApiService: FeedApiService | undefined;
  let feedIdentityService: FeedIdentityService | undefined;
  let feedInboxDecryptionService: FeedInboxDecryptionService | undefined;
  let feedFollowService: FeedFollowService | undefined;
  let stringSharer: StringSharer | undefined;
  let fileExportService: FileExportService | undefined;
  let filePickerService: FilePickerService | undefined;
  let aiChatService: AiChatService | undefined;
  let healthExportService: HES | undefined;

  const getEncryptionService = () =>
    (encryptionService ??= new EncryptionService());
  const getFeedApiService = () => (feedApiService ??= new FeedApiService());

  return {
    logger,
    keyValueStore,
    progressRepository,
    sessionService,
    preferenceService,
    workoutWorkerService,
    tolgee,
    db,
    expoDb,
    databaseMigrationService,

    get notificationService() {
      return (notificationService ??= new NotificationService(
        store.getState,
        store.dispatch,
      ));
    },
    get encryptionService() {
      return getEncryptionService();
    },
    get feedApiService() {
      return getFeedApiService();
    },
    get feedIdentityService() {
      return (feedIdentityService ??= new FeedIdentityService(
        getFeedApiService(),
        getEncryptionService(),
      ));
    },
    get feedInboxDecryptionService() {
      return (feedInboxDecryptionService ??= new FeedInboxDecryptionService(
        getEncryptionService(),
        getFeedApiService(),
      ));
    },
    get feedFollowService() {
      return (feedFollowService ??= new FeedFollowService(
        getFeedApiService(),
        getEncryptionService(),
      ));
    },
    get stringSharer() {
      return (stringSharer ??= new StringSharer());
    },
    get fileExportService() {
      return (fileExportService ??= new FileExportService());
    },
    get filePickerService() {
      return (filePickerService ??= new FilePickerService());
    },
    get aiChatService() {
      return (aiChatService ??= new AiChatService(
        new HubConnectionFactory(),
        store.getState,
      ));
    },
    get healthExportService(): HES {
      return (healthExportService ??= new HealthExportService());
    },
  };
}

function resolveServices(
  store: Store<RootState>,
  db: ExpoSQLiteDatabase,
  expoDb: SQLiteDatabase,
) {
  return (resolvedServices ??= resolveServicesInternal(store, db, expoDb));
}

export { resolveServices };
