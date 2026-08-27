import type { AiChatService } from '@/services/ai-chat-service';
import type { EncryptionService } from '@/services/encryption-service';
import type { FeedApiService } from '@/services/feed-api';
import type { FeedFollowService } from '@/services/feed-follow-service';
import type { FeedIdentityService } from '@/services/feed-identity-service';
import type { FeedInboxDecryptionService } from '@/services/feed-inbox-decryption-service';
import type { FileExportService } from '@/services/file-export-service';
import type { FilePickerService } from '@/services/file-picker-service';
import type { NotificationService } from '@/services/notification-service';
import type { ProgressRepository } from '@/services/progress-repository';
import type { StringSharer } from '@/services/string-sharer';
import { KeyValueStore } from '@/services/key-value-store';
import { Logger } from '@/services/logger';
import { PreferenceService } from '@/services/preference-service';
import { SessionService } from '@/services/session-service';
import { getTolgee } from '@/services/tolgee';
import { WorkoutWorker } from '@/services/workout-worker';
import { RootState } from '@/store';
import { Store } from '@reduxjs/toolkit';
import type { HealthExportService as HES } from './health-export-service-shared';
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

  const logger = new Logger();
  const keyValueStore = new KeyValueStore();
  const sessionService = new SessionService(keyValueStore, db, store.getState);
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
    keyValueStore,
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
  let progressRepository: ProgressRepository | undefined;
  let aiChatService: AiChatService | undefined;
  let healthExportService: HES | undefined;

  const getEncryptionService = (): EncryptionService => {
    if (!encryptionService) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { EncryptionService: Service } = require('./encryption-service') as {
        EncryptionService: new () => EncryptionService;
      };
      encryptionService = new Service();
    }
    return encryptionService;
  };

  const getFeedApiService = (): FeedApiService => {
    if (!feedApiService) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { FeedApiService: Service } = require('./feed-api') as {
        FeedApiService: new () => FeedApiService;
      };
      feedApiService = new Service();
    }
    return feedApiService;
  };

  return {
    logger,
    keyValueStore,
    sessionService,
    get progressRepository(): ProgressRepository {
      if (!progressRepository) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { ProgressRepository: Service } = require('./progress-repository') as {
          ProgressRepository: new (getState: () => RootState) => ProgressRepository;
        };
        progressRepository = new Service(store.getState);
      }
      return progressRepository;
    },
    preferenceService,
    workoutWorkerService,
    tolgee,
    db,
    expoDb,
    databaseMigrationService,

    get notificationService(): NotificationService {
      if (!notificationService) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NotificationService: Service } = require('./notification-service') as {
          NotificationService: new (
            getState: () => RootState,
            dispatch: Store<RootState>['dispatch'],
          ) => NotificationService;
        };
        notificationService = new Service(store.getState, store.dispatch);
      }
      return notificationService;
    },
    get encryptionService() {
      return getEncryptionService();
    },
    get feedApiService() {
      return getFeedApiService();
    },
    get feedIdentityService(): FeedIdentityService {
      if (!feedIdentityService) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { FeedIdentityService: Service } = require('./feed-identity-service') as {
          FeedIdentityService: new (
            feedApiService: FeedApiService,
            encryptionService: EncryptionService,
          ) => FeedIdentityService;
        };
        feedIdentityService = new Service(
          getFeedApiService(),
          getEncryptionService(),
        );
      }
      return feedIdentityService;
    },
    get feedInboxDecryptionService(): FeedInboxDecryptionService {
      if (!feedInboxDecryptionService) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { FeedInboxDecryptionService: Service } = require('./feed-inbox-decryption-service') as {
          FeedInboxDecryptionService: new (
            encryptionService: EncryptionService,
            feedApiService: FeedApiService,
          ) => FeedInboxDecryptionService;
        };
        feedInboxDecryptionService = new Service(
          getEncryptionService(),
          getFeedApiService(),
        );
      }
      return feedInboxDecryptionService;
    },
    get feedFollowService(): FeedFollowService {
      if (!feedFollowService) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { FeedFollowService: Service } = require('./feed-follow-service') as {
          FeedFollowService: new (
            feedApiService: FeedApiService,
            encryptionService: EncryptionService,
          ) => FeedFollowService;
        };
        feedFollowService = new Service(
          getFeedApiService(),
          getEncryptionService(),
        );
      }
      return feedFollowService;
    },
    get stringSharer(): StringSharer {
      if (!stringSharer) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { StringSharer: Service } = require('./string-sharer') as {
          StringSharer: new () => StringSharer;
        };
        stringSharer = new Service();
      }
      return stringSharer;
    },
    get fileExportService(): FileExportService {
      if (!fileExportService) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { FileExportService: Service } = require('./file-export-service') as {
          FileExportService: new () => FileExportService;
        };
        fileExportService = new Service();
      }
      return fileExportService;
    },
    get filePickerService(): FilePickerService {
      if (!filePickerService) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { FilePickerService: Service } = require('./file-picker-service') as {
          FilePickerService: new () => FilePickerService;
        };
        filePickerService = new Service();
      }
      return filePickerService;
    },
    get aiChatService(): AiChatService {
      if (!aiChatService) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { AiChatService: Service } = require('./ai-chat-service') as {
          AiChatService: new (
            hubConnectionFactory: unknown,
            getState: () => RootState,
          ) => AiChatService;
        };
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { HubConnectionFactory } = require('./hub-connection-factory') as {
          HubConnectionFactory: new () => unknown;
        };
        aiChatService = new Service(new HubConnectionFactory(), store.getState);
      }
      return aiChatService;
    },
    get healthExportService(): HES {
      if (!healthExportService) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { HealthExportService: Service } = require('./health-export-service') as {
          HealthExportService: new () => HES;
        };
        healthExportService = new Service();
      }
      return healthExportService;
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
