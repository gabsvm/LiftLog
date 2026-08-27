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
 * Core payloads are required before the training UI can safely deserialize its
 * state. Feed payloads are intentionally separate because Feed is lazy in
 * GainsLab and must not delay the critical startup path.
 */
export const latestCoreDataMigrationSignature = [
  sessionMigrations.latestVersion,
  programBlueprintMigrations.latestVersion,
  exerciseDescriptorMigrations.latestVersion,
].join(':');

export const latestFeedDataMigrationSignature = [
  feedIdentityMigrations.latestVersion,
  followedFeedUserMigrations.latestVersion,
  sessionUserEventMigrations.latestVersion,
  followerFeedUserMigrations.latestVersion,
  followRequestInboxMessageMigrations.latestVersion,
  pendingFeedUserMigrations.latestVersion,
].join(':');

/**
 * Legacy combined signature retained so an installation that already completed
 * the previous all-at-startup migration pass does not needlessly rescan its
 * payload tables after updating to the split scheme.
 */
export const latestDataMigrationSignature = [
  latestCoreDataMigrationSignature,
  latestFeedDataMigrationSignature,
].join(':');
