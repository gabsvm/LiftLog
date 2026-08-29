import ConfirmationDialog from '@/components/presentation/foundation/confirmation-dialog';
import { Session } from '@/models/session-models';
import { useAppSelectorWithArg } from '@/store';
import {
  selectCurrentSession,
  setCurrentSession,
} from '@/store/current-session';
import { T, useTranslate } from '@tolgee/react';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useDebouncedCallback } from 'use-debounce';

export function CurrentWorkoutReplacer({
  session,
  clearSession,
}: {
  session: Session | undefined;
  clearSession: () => void;
}) {
  if (!session) {
    return null;
  }

  return (
    <ActiveWorkoutReplacer session={session} clearSession={clearSession} />
  );
}

function ActiveWorkoutReplacer({
  session,
  clearSession,
}: {
  session: Session;
  clearSession: () => void;
}) {
  const { t } = useTranslate();
  const { push } = useRouter();
  const currentSession = useAppSelectorWithArg(
    selectCurrentSession,
    'workoutSession',
  );
  const hasCurrentSession = !!currentSession;
  const activeSessionSameAsSelected = session.equals(currentSession);
  const dispatch = useDispatch();
  const replaceSession = useDebouncedCallback(
    (nextSession: Session) => {
      clearSession();
      dispatch(
        setCurrentSession({
          target: 'workoutSession',
          session: nextSession,
        }),
      );
      push('/(session)/session', { withAnchor: true });
    },
    500,
    { leading: true, trailing: false },
  );

  useEffect(() => {
    if (!hasCurrentSession || activeSessionSameAsSelected) {
      replaceSession(session);
    }
  }, [session, hasCurrentSession, replaceSession, activeSessionSameAsSelected]);

  return (
    <ConfirmationDialog
      open={hasCurrentSession && !activeSessionSameAsSelected}
      onCancel={clearSession}
      okText={t('generic.replace.button')}
      onOk={() => replaceSession(session)}
      headline={<T keyName="workout.replace_current.confirm.title" />}
      textContent={<T keyName="workout.replace_in_progress.confirm.body" />}
    />
  );
}
