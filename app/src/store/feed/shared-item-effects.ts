import { AesKey } from '@/models/encryption-models';
import { FeedIdentity, fromSharedItemJSON } from '@/models/feed-models';
import { RemoteData } from '@/models/remote';
import { SharedItemJSON } from '@/models/storage/versions/latest';
import { ApiErrorType } from '@/services/api-error';
import { fromJsonBytes, toJsonBytes } from '@/services/encryption-service';
import {
  encryptAndShare,
  feedApiError,
  fetchSharedItem,
  setIdentity,
  setSharedItem,
} from '@/store/feed';
import { AddEffectFn } from '@/store/store';
import { toUrlSafeHexString } from '@/utils/to-url-safe-hex-string';
import { feedIdentitySchema } from '@/db/schema';

export function addSharedItemEffects(addEffect: AddEffectFn) {
  addEffect(
    encryptAndShare,
    async (
      action,
      {
        cancelActiveListeners,
        getState,
        dispatch,
        extra: {
          db,
          encryptionService,
          feedApiService,
          feedIdentityService,
          stringSharer,
          logger,
        },
      },
    ) => {
      cancelActiveListeners();

      let identity = getState().feed.identity.match({
        success: (value) => value,
        error: () => undefined,
        loading: () => undefined,
        notAsked: () => undefined,
      });

      if (!identity) {
        // GainsLab no longer hydrates the whole hidden Feed feature at startup.
        // Sharing only needs an identity, so restore/create that single piece on
        // demand rather than loading feed items/followers/inbox first.
        const storedIdentity = (await db.select().from(feedIdentitySchema)).at(0);
        if (storedIdentity) {
          identity = FeedIdentity.fromJSON(storedIdentity.payload);
          dispatch(setIdentity(RemoteData.success(identity)));
        } else {
          const identityResult =
            await feedIdentityService.createFeedIdentityAsync(
              undefined,
              false,
              false,
              false,
              undefined,
            );
          if (identityResult.isSuccess()) {
            identity = identityResult.data;
            dispatch(setIdentity(RemoteData.success(identity)));
          } else {
            dispatch(
              feedApiError({
                error: identityResult.error!,
                message: 'Failed to share. Identity could not be created',
                action: {
                  ...action,
                  payload: { ...action.payload, fromUserAction: true },
                },
              }),
            );
            return;
          }
        }
      }

      if (!identity) {
        logger.debug('Identity unavailable after on-demand initialization', undefined);
        dispatch(
          feedApiError({
            error: {
              exception: new Error('No identity'),
              message: 'Failed to share. Identity not found',
              type: ApiErrorType.Unknown,
            },
            message: 'Failed to share. Identity not found',
            action: {
              ...action,
              payload: { ...action.payload, fromUserAction: true },
            },
          }),
        );
        return;
      }

      const aesKey = await encryptionService.generateAesKey();
      const payload = action.payload.item.toJSON();
      const payloadBytes = toJsonBytes(payload);

      const encrypted =
        await encryptionService.signRsa256PssAndEncryptAesCbcAsync(
          payloadBytes,
          aesKey,
          identity.rsaKeyPair.privateKey,
        );

      const result = await feedApiService.postSharedItemAsync({
        userId: identity.id,
        password: identity.password,
        encryptedPayload: encrypted,
        expiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (!result.isSuccess()) {
        dispatch(
          feedApiError({
            message: 'Failed to share feed item',
            error: result.error!,
            action: {
              ...action,
              payload: { ...action.payload, fromUserAction: true },
            },
          }),
        );
        return;
      }

      await stringSharer.share(
        getShareUrl(result.data.id, aesKey),
        action.payload.title,
      );
    },
  );

  addEffect(
    fetchSharedItem,
    async (
      a,
      { dispatch, extra: { feedApiService, encryptionService }, onFail },
    ) => {
      onFail(() => {
        dispatch(
          setSharedItem(
            RemoteData.error(
              'Could not read shared item. Please update LiftLog.',
            ),
          ),
        );
      });
      dispatch(setSharedItem(RemoteData.loading()));
      const shared = await feedApiService.getSharedItemAsync(a.payload.id);
      if (!shared.isSuccess()) {
        dispatch(setSharedItem(RemoteData.error(shared.error)));
        return;
      }
      const { encryptedPayload, rsaPublicKey } = shared.data;
      const { key: aesKey } = a.payload;
      const decryptedBytes =
        await encryptionService.decryptAesCbcAndVerifyRsa256PssAsync(
          encryptedPayload,
          aesKey,
          rsaPublicKey,
        );
      const sharedItemDao = fromJsonBytes<SharedItemJSON>(decryptedBytes);
      const sharedItem = fromSharedItemJSON(sharedItemDao);

      dispatch(setSharedItem(RemoteData.success(sharedItem)));
    },
  );
}

function getShareUrl(sharedItemId: string, aesKey: AesKey) {
  return `https://app.liftlog.online/feed/shared-item/${sharedItemId}?k=${toUrlSafeHexString(aesKey.value)}`;
}
