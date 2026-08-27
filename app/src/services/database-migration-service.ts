import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';

import {
  updateExercisesToLatestVersion,
  updateFeedFollowedUsersToLatestVersion,
  updateFeedFollowerUsersToLatestVersion,
  updateFeedFollowRequestsToLatestVersion,
  updateFeedIdentityToLatestVersion,
  updateFeedItemsToLatestVersion,
  updateFeedPendingUsersToLatestVersion,
  updateProgramsToLatestVersion,
  updateSessionsToLatestVersion,
} from './data-migrations/update-to-latest';
import {
  latestCoreDataMigrationSignature,
  latestDataMigrationSignature,
  latestFeedDataMigrationSignature,
} from './data-migrations/latest-version-signature';
import { DatabaseImporter } from '@/services/database-import-service';
import { KeyValueStore } from '@/services/key-value-store';
import { Logger } from '@/services/logger';

const legacyDataMigrationSignatureStorageKey = 'LatestDataMigrationSignatureV1';
const coreDataMigrationSignatureStorageKey =
  'LatestCoreDataMigrationSignatureV1';
const feedDataMigrationSignatureStorageKey =
  'LatestFeedDataMigrationSignatureV1';

export class DatabaseMigrationService {
  constructor(
    private readonly db: ExpoSQLiteDatabase,
    private readonly logger: Logger,
    private readonly importService: DatabaseImporter,
    private readonly keyValueStore?: Pick<KeyValueStore, 'getItem' | 'setItem'>,
  ) {}

  /**
   * Prepare only data required by the training experience. Feed migrations are
   * deliberately lazy so a hidden/advanced feature cannot block app startup.
   */
  async migrate(): Promise<void> {
    const now = performance.now();
    await migrate(this.db, migrations);
    await this.importService.importOldData();

    const [storedCoreSignature, legacySignature] = await Promise.all([
      this.readSignature(coreDataMigrationSignatureStorageKey),
      this.readSignature(legacyDataMigrationSignatureStorageKey),
    ]);

    if (storedCoreSignature !== latestCoreDataMigrationSignature) {
      // The previous implementation stored a combined signature after all
      // payload migrations completed. Treat it as proof that core data is
      // already current and avoid a one-time rescan for existing installs.
      if (legacySignature !== latestDataMigrationSignature) {
        await updateSessionsToLatestVersion(this.db);
        await updateProgramsToLatestVersion(this.db);
        await updateExercisesToLatestVersion(this.db);
      }
      await this.writeSignature(
        coreDataMigrationSignatureStorageKey,
        latestCoreDataMigrationSignature,
      );
    }

    this.logger.info(
      'Migrated core DB in ' + (performance.now() - now) + 'ms',
    );
  }

  /** Run Feed payload migrations immediately before Feed hydration. */
  async migrateFeedData(): Promise<void> {
    const now = performance.now();
    const [storedFeedSignature, legacySignature] = await Promise.all([
      this.readSignature(feedDataMigrationSignatureStorageKey),
      this.readSignature(legacyDataMigrationSignatureStorageKey),
    ]);

    if (storedFeedSignature === latestFeedDataMigrationSignature) return;

    if (legacySignature !== latestDataMigrationSignature) {
      await updateFeedIdentityToLatestVersion(this.db);
      await updateFeedFollowedUsersToLatestVersion(this.db);
      await updateFeedItemsToLatestVersion(this.db);
      await updateFeedFollowerUsersToLatestVersion(this.db);
      await updateFeedFollowRequestsToLatestVersion(this.db);
      await updateFeedPendingUsersToLatestVersion(this.db);
    }

    await this.writeSignature(
      feedDataMigrationSignatureStorageKey,
      latestFeedDataMigrationSignature,
    );
    this.logger.info(
      'Migrated Feed data in ' + (performance.now() - now) + 'ms',
    );
  }

  private async readSignature(key: string): Promise<string | undefined> {
    if (!this.keyValueStore) return undefined;
    try {
      return await this.keyValueStore.getItem(key);
    } catch (error) {
      // Signature files are only an optimization. A filesystem bookkeeping
      // failure must never prevent the database itself from becoming usable.
      this.logger.warn(`Failed to read data migration signature [${key}]`, {
        error,
      });
      return undefined;
    }
  }

  private async writeSignature(key: string, value: string): Promise<void> {
    if (!this.keyValueStore) return;
    try {
      await this.keyValueStore.setItem(key, value);
    } catch (error) {
      // If this fails the safe fallback is simply to re-check migrations on a
      // future launch; do not turn successful data preparation into a startup
      // failure because an optimization marker could not be persisted.
      this.logger.warn(`Failed to persist data migration signature [${key}]`, {
        error,
      });
    }
  }
}
