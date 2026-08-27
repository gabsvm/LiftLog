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
import { latestDataMigrationSignature } from './data-migrations/latest-version-signature';
import { DatabaseImporter } from '@/services/database-import-service';
import { KeyValueStore } from '@/services/key-value-store';
import { Logger } from '@/services/logger';

const latestDataMigrationSignatureStorageKey = 'LatestDataMigrationSignatureV1';

export class DatabaseMigrationService {
  constructor(
    private readonly db: ExpoSQLiteDatabase,
    private readonly logger: Logger,
    private readonly importService: DatabaseImporter,
    private readonly keyValueStore?: Pick<KeyValueStore, 'getItem' | 'setItem'>,
  ) {}

  async migrate(): Promise<void> {
    const now = performance.now();
    await migrate(this.db, migrations);
    await this.importService.importOldData();

    const storedSignature = await this.keyValueStore?.getItem(
      latestDataMigrationSignatureStorageKey,
    );
    if (storedSignature !== latestDataMigrationSignature) {
      await updateSessionsToLatestVersion(this.db);
      await updateProgramsToLatestVersion(this.db);
      await updateExercisesToLatestVersion(this.db);
      await updateFeedIdentityToLatestVersion(this.db);
      await updateFeedFollowedUsersToLatestVersion(this.db);
      await updateFeedItemsToLatestVersion(this.db);
      await updateFeedFollowerUsersToLatestVersion(this.db);
      await updateFeedFollowRequestsToLatestVersion(this.db);
      await updateFeedPendingUsersToLatestVersion(this.db);
      await this.keyValueStore?.setItem(
        latestDataMigrationSignatureStorageKey,
        latestDataMigrationSignature,
      );
    }

    this.logger.info('Migrated DB in ' + (performance.now() - now) + 'ms');
  }
}
