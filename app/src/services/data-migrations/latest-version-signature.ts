import { sessionMigrations } from '@/models/storage/versions/migrations/session';
import {
  exerciseDescriptorMigrations,
  followRequestInboxMessageMigrations,
  feedIdentityMigrations,
  sessionUserEventMigrations,
  followedFeedUserMigrations,
  followerFeedUserMigrations,
  programBlueprintMigrations,
  pendingFeedUserMigrations,
} from '@/models/storage/versions/migrations';

/**
 * Changes automatically whenever one of the JSON payload migration chains gets
 * a new latest version. DatabaseMigrationService can therefore avoid scanning
 * every JSON table on every cold start while still rerunning the migrations
 * after a real format change.
 */
export const latestDataMigrationSignature = [
  sessionMigrations.latestVersion,
  programBlueprintMigrations.latestVersion,
  exerciseDescriptorMigrations.latestVersion,
  feedIdentityMigrations.latestVersion,
  followedFeedUserMigrations.latestVersion,
  sessionUserEventMigrations.latestVersion,
  followerFeedUserMigrations.latestVersion,
  followRequestInboxMessageMigrations.latestVersion,
  pendingFeedUserMigrations.latestVersion,
].join(':');
