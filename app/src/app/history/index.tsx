import CardActions from '@/components/presentation/foundation/card-actions';
import CardList from '@/components/presentation/foundation/card-list';
import ConfirmationDialog from '@/components/presentation/foundation/confirmation-dialog';
import EmptyInfo from '@/components/presentation/foundation/empty-info';
import {
  ScreenHeading,
  SectionHeading,
} from '@/components/presentation/foundation/screen-heading';
import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import { gainsLabRadii } from '@/components/presentation/foundation/gainslab-ui';
import IconButton from '@/components/presentation/foundation/gesture-wrappers/icon-button';
import HistoryCalendarCard from '@/components/presentation/summary/history-calendar-card';
import LimitedHtml from '@/components/presentation/foundation/limited-html';
import SessionSummaryTitle from '@/components/presentation/summary/session-summary-title';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { Session } from '@/models/session-models';
import { useAppSelector } from '@/store';
import {
  selectCurrentSession,
  setCurrentSession,
} from '@/store/current-session';
import { addUnpublishedSessionId, encryptAndShare } from '@/store/feed';
import {
  deleteStoredSession,
  getSessionReferenceTime,
} from '@/store/stored-sessions';
import {
  getHistoryCalendarRange,
  requestHistoryRange,
  selectHistoryViewLoading,
  selectHistoryViewSessions,
} from '@/store/history-view';
import { uuid } from '@/utils/uuid';
import { LocalDate, YearMonth } from '@js-joda/core';
import { useTranslate } from '@tolgee/react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { useFormatDate } from '@/hooks/useFormatDate';
import { SharedSession } from '@/models/feed-models';
import { GainsLabMenu } from '@/components/presentation/foundation/gainslab-overlays';

export default function History() {
  const { t } = useTranslate();
  const { colors } = useAppTheme();
  const dispatch = useDispatch();
  const formatDate = useFormatDate();
  const [currentYearMonth, setCurrentYearMonth] = useState(YearMonth.now());
  const historyLoading = useAppSelector(selectHistoryViewLoading);
  const historySessions = useAppSelector(selectHistoryViewSessions);
  const latesBodyweight = useAppSelector((x) =>
    x.program.upcomingSessions
      .map((x) => x.at(0)?.bodyweight)
      .unwrapOr(undefined),
  );
  const { push } = useRouter();
  const hasCurrentWorkoutSession = useAppSelector(
    (state) => !!selectCurrentSession(state, 'workoutSession'),
  );

  const sessionsInMonth = useMemo(
    () =>
      historySessions
        .filter(
          (session) =>
            session.date.year() === currentYearMonth.year() &&
            session.date.month().equals(currentYearMonth.month()),
        )
        .sort((a, b) =>
          getSessionReferenceTime(b).compareTo(getSessionReferenceTime(a)),
        ),
    [currentYearMonth, historySessions],
  );

  useFocusEffect(
    useCallback(() => {
      dispatch(requestHistoryRange(getHistoryCalendarRange(currentYearMonth)));
    }, [currentYearMonth, dispatch]),
  );

  const onSelectSession = (session: Session) => {
    dispatch(setCurrentSession({ target: 'historySession', session }));
    push('/history/edit');
  };

  const createSessionAtDate = (date: LocalDate) => {
    const newSession = Session.freeformSession(date, latesBodyweight);
    onSelectSession(newSession);
  };

  const [
    replaceCurrentSessionConfirmOpen,
    setReplaceCurrentSessionConfirmOpen,
  ] = useState(false);
  const [
    deleteSelectedWorkoutConfirmOpen,
    setDeleteSelectedWorkoutConfirmOpen,
  ] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Session>();

  const deleteWorkout = (session: Session, force = false) => {
    if (!force) {
      setSelectedWorkout(session);
      setDeleteSelectedWorkoutConfirmOpen(true);
    } else if (selectedWorkout) {
      dispatch(deleteStoredSession(selectedWorkout.id));
      dispatch(addUnpublishedSessionId(selectedWorkout.id));
      setDeleteSelectedWorkoutConfirmOpen(false);
      setSelectedWorkout(undefined);
    }
  };

  const startWorkout = (session: Session, force = false) => {
    if (hasCurrentWorkoutSession && !force) {
      setSelectedWorkout(session);
      setReplaceCurrentSessionConfirmOpen(true);
    } else {
      dispatch(
        setCurrentSession({
          target: 'workoutSession',
          session: session
            .withNothingCompleted()
            .with({ date: LocalDate.now(), id: uuid() }),
        }),
      );
      setReplaceCurrentSessionConfirmOpen(false);
      setSelectedWorkout(undefined);
      push('/(session)/session', { withAnchor: true });
    }
  };

  const handleSharePress = (session: Session) => {
    dispatch(
      encryptAndShare({
        item: new SharedSession(session),
        title: t('workout.shared_item.title'),
      }),
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t('generic.history.title'),
          headerShown: false,
        }}
      />
      <FullHeightScrollView
        contentContainerStyle={{
          gap: spacing[4],
          paddingTop: spacing[4],
          paddingBottom: spacing[8],
          paddingHorizontal: spacing.pageHorizontalMargin,
        }}
      >
        <ScreenHeading
          title={t('generic.history.title')}
          subtitle={t('screen.history.subtitle')}
        />
        {historyLoading ? (
          <HistoryLoadingState />
        ) : (
          <>
            <HistoryCalendarCard
              currentYearMonth={currentYearMonth}
              sessions={historySessions}
              onDateSelect={createSessionAtDate}
              onMonthChange={setCurrentYearMonth}
              onSessionSelect={onSelectSession}
            />
            <SectionHeading
              title={t('workout.sessions_in_month.title')}
              detail={`${sessionsInMonth.length}`}
            />
            <CardList
              testID="history-list"
              items={sessionsInMonth}
              keySelector={(session) => session.id}
              cardType="contained"
              onPress={onSelectSession}
              renderItemContent={(session) => (
                <Card.Content>
                  <SessionSummaryTitle isFilled session={session} />
                  <View style={styles.exercisePreview}>
                    {session.recordedExercises
                      .slice(0, 3)
                      .map((exercise, index) => (
                        <View
                          key={`${exercise.blueprint.name}-${index}`}
                          style={styles.exerciseRow}
                        >
                          <Text
                            variant="labelMedium"
                            style={[
                              styles.exerciseIndex,
                              { color: colors.primary },
                            ]}
                          >
                            {(index + 1).toString().padStart(2, '0')}
                          </Text>
                          <Text
                            variant="bodyMedium"
                            numberOfLines={1}
                            style={{ flex: 1 }}
                          >
                            {exercise.blueprint.name}
                          </Text>
                        </View>
                      ))}
                    {session.recordedExercises.length > 3 ? (
                      <HistoryMoreCount
                        count={session.recordedExercises.length - 3}
                      />
                    ) : null}
                  </View>
                </Card.Content>
              )}
              renderItemActions={(session) => (
                <HistorySessionActions
                  session={session}
                  onRepeat={() => startWorkout(session)}
                  onEdit={() => onSelectSession(session)}
                  onShare={() => handleSharePress(session)}
                  onDelete={() => deleteWorkout(session)}
                />
              )}
              emptyTemplate={
                <EmptyInfo>
                  <LimitedHtml
                    value={t('workout.no_sessions_in_month.message', {
                      month: formatDate(currentYearMonth.atDay(1), {
                        month: 'long',
                      }),
                    })}
                  />
                </EmptyInfo>
              }
            />
          </>
        )}
      </FullHeightScrollView>

      {replaceCurrentSessionConfirmOpen ? (
        <ConfirmationDialog
          headline={t('workout.replace_current.confirm.title')}
          textContent={t('workout.replace_in_progress.confirm.body')}
          open
          okText={t('generic.replace.button')}
          onOk={() => selectedWorkout && startWorkout(selectedWorkout, true)}
          onCancel={() => {
            setSelectedWorkout(undefined);
            setReplaceCurrentSessionConfirmOpen(false);
          }}
        />
      ) : null}
      {deleteSelectedWorkoutConfirmOpen ? (
        <ConfirmationDialog
          headline={t('workout.delete.confirm.title')}
          textContent={
            <LimitedHtml
              value={t('workout.delete.confirm.body', {
                sessionName: selectedWorkout?.blueprint.name ?? '',
                date: formatDate(selectedWorkout?.date ?? LocalDate.now(), {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
              })}
            />
          }
          open
          okText={t('generic.delete.button')}
          onOk={() => selectedWorkout && deleteWorkout(selectedWorkout, true)}
          onCancel={() => {
            setSelectedWorkout(undefined);
            setDeleteSelectedWorkoutConfirmOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function HistoryLoadingState() {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: spacing[4] }}>
      <View
        style={{
          height: 292,
          borderRadius: gainsLabRadii.card,
          backgroundColor: colors.surfaceContainerLow,
        }}
      />
      {[0, 1].map((index) => (
        <View
          key={index}
          style={{
            height: 128,
            borderRadius: gainsLabRadii.card,
            backgroundColor: colors.surfaceContainerLow,
          }}
        />
      ))}
    </View>
  );
}

function HistorySessionActions({
  session,
  onRepeat,
  onEdit,
  onShare,
  onDelete,
}: {
  session: Session;
  onRepeat: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslate();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <CardActions style={styles.historyActions}>
      <IconButton
        icon="playCircle"
        onPress={onRepeat}
        accessibilityLabel={t('workout.start_this.button')}
      />
      <GainsLabMenu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <IconButton
            icon="moreHoriz"
            onPress={() => setMenuVisible(true)}
            accessibilityLabel={`${t('navigation.more')}: ${session.blueprint.name}`}
          />
        }
      >
        {menuVisible ? (
          <>
            <GainsLabMenu.Item
              testID="history-edit-workout"
              leadingIcon="edit"
              title={t('workout.edit.button')}
              onPress={() => {
                setMenuVisible(false);
                onEdit();
              }}
            />
            <GainsLabMenu.Item
              leadingIcon="share"
              title={t('workout.share_workout.button')}
              onPress={() => {
                setMenuVisible(false);
                onShare();
              }}
            />
            <GainsLabMenu.Item
              leadingIcon="delete"
              title={t('generic.delete.button')}
              onPress={() => {
                setMenuVisible(false);
                onDelete();
              }}
            />
          </>
        ) : null}
      </GainsLabMenu>
    </CardActions>
  );
}

function HistoryMoreCount({ count }: { count: number }) {
  const { colors } = useAppTheme();
  const { t } = useTranslate();
  return (
    <Text
      variant="labelMedium"
      style={{ color: colors.onSurfaceVariant, marginTop: spacing[1] }}
    >
      {t('home.more_exercises', { count })}
    </Text>
  );
}

const styles = StyleSheet.create({
  exercisePreview: {
    gap: spacing[2],
    marginTop: spacing[4],
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  exerciseIndex: {
    width: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  historyActions: {
    gap: spacing[1],
    marginTop: spacing[1],
    justifyContent: 'flex-end',
  },
});
