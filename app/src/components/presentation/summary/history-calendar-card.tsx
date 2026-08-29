import { SurfaceText } from '@/components/presentation/foundation/surface-text';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { Session } from '@/models/session-models';
import { useAppSelector } from '@/store';
import { getDateOnDay } from '@/utils/format-date';
import { DayOfWeek, LocalDate, Year, YearMonth } from '@js-joda/core';
import { I18nManager, View } from 'react-native';
import { Card } from 'react-native-paper';
import IconButton from '@/components/presentation/foundation/gesture-wrappers/icon-button';
import TouchableRipple from '@/components/presentation/foundation/gesture-wrappers/touchable-ripple';
import { ReactNode, useMemo } from 'react';
import { useFormatDate } from '@/hooks/useFormatDate';

interface HistoryCalendarCardProps {
  currentYearMonth: YearMonth;
  sessions: Session[];
  onMonthChange: (date: YearMonth) => void;
  onDateSelect: (date: LocalDate) => void;
  onSessionSelect: (Session: Session) => void;
  onDeleteSession: (session: Session) => void;
}

type CalendarDayModel = {
  date: LocalDate;
  label: string;
};

export default function HistoryCalendarCard({
  currentYearMonth,
  sessions,
  onMonthChange,
  onDateSelect,
  onSessionSelect,
  onDeleteSession,
}: HistoryCalendarCardProps) {
  const firstDayOfMonth = useMemo(
    () => currentYearMonth.atDay(1),
    [currentYearMonth],
  );
  const today = LocalDate.now();
  const formatDate = useFormatDate();
  const firstDayOfWeek = useAppSelector((x) => x.settings.firstDayOfWeek);
  const firstDayOfWeekValue = firstDayOfWeek.value();
  const disableNextMonth = currentYearMonth.equals(YearMonth.now());

  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, Session[]>();
    for (const session of sessions) {
      const dateKey = session.date.toString();
      const sessionsForDate = grouped.get(dateKey);
      if (sessionsForDate) {
        sessionsForDate.push(session);
      } else {
        grouped.set(dateKey, [session]);
      }
    }
    return grouped;
  }, [sessions]);

  const calendarWeeks = useMemo(() => {
    const dayOfFirstDayOfTheMonth = firstDayOfMonth.dayOfWeek().value();
    const previousCount =
      (dayOfFirstDayOfTheMonth - firstDayOfWeekValue + 7) % 7;
    const nextCount =
      (7 - ((previousCount + currentYearMonth.lengthOfMonth()) % 7)) % 7;
    const days: CalendarDayModel[] = [];

    for (let offset = -previousCount; offset < 0; offset++) {
      const date = firstDayOfMonth.plusDays(offset);
      days.push({ date, label: formatDate(date, { day: 'numeric' }) });
    }
    for (let day = 1; day <= currentYearMonth.lengthOfMonth(); day++) {
      const date = firstDayOfMonth.withDayOfMonth(day);
      days.push({ date, label: formatDate(date, { day: 'numeric' }) });
    }
    for (let day = 1; day <= nextCount; day++) {
      const date = firstDayOfMonth.plusMonths(1).withDayOfMonth(day);
      days.push({ date, label: formatDate(date, { day: 'numeric' }) });
    }

    const weeks: CalendarDayModel[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      weeks.push(days.slice(index, index + 7));
    }
    return weeks;
  }, [currentYearMonth, firstDayOfMonth, firstDayOfWeekValue, formatDate]);

  const dayHeaderLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, offset) => {
        const dayOfWeek = (offset + firstDayOfWeek.ordinal()) % 7;
        return {
          dayOfWeek,
          label: formatDate(getDateOnDay(DayOfWeek.of(dayOfWeek + 1)), {
            weekday: 'short',
          }),
        };
      }),
    [firstDayOfWeek, formatDate],
  );

  const previousMonth = () => onMonthChange(currentYearMonth.minusMonths(1));
  const nextMonth = () => onMonthChange(currentYearMonth.plusMonths(1));

  const handleDayPress = (date: LocalDate) => {
    const session = sessionsByDate.get(date.toString())?.[0];
    if (session) {
      onSessionSelect(session);
    } else {
      onDateSelect(date);
    }
  };

  const handleDayLongPress = (date: LocalDate) => {
    const session = sessionsByDate.get(date.toString())?.[0];
    if (session) {
      onDeleteSession(session);
    }
  };

  const monthLabel = formatDate(firstDayOfMonth, {
    month: 'long',
    year:
      currentYearMonth.year() === Year.now().value() ? undefined : 'numeric',
  });
  const previousMonthLabel = formatDate(currentYearMonth.minusMonths(1).atDay(1), {
    month: 'long',
    year: 'numeric',
  });
  const nextMonthLabel = formatDate(currentYearMonth.plusMonths(1).atDay(1), {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Card mode="contained">
      <Card.Content>
        <View
          style={{ justifyContent: 'center', alignItems: 'stretch', flex: 3 }}
        >
          <ForceLTRRow>
            <View style={{ flex: 1 }}>
              <IconButton
                testID="calendar-nav-previous-month"
                icon="chevronLeft"
                accessibilityLabel={previousMonthLabel}
                onPress={previousMonth}
              />
            </View>
            <View
              style={{
                flex: 5,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <SurfaceText testID="calendar-month">{monthLabel}</SurfaceText>
            </View>
            <View style={{ flex: 1 }}>
              <IconButton
                testID="calendar-nav-next-month"
                icon="chevronRight"
                accessibilityLabel={nextMonthLabel}
                onPress={nextMonth}
                disabled={disableNextMonth}
              />
            </View>
          </ForceLTRRow>

          <ForceLTRRow>
            {dayHeaderLabels.map(({ dayOfWeek, label }) => (
              <View style={{ flex: 1 }} key={dayOfWeek}>
                <SurfaceText
                  style={{ marginBottom: spacing[2], textAlign: 'center' }}
                >
                  {label}
                </SurfaceText>
              </View>
            ))}
          </ForceLTRRow>

          {calendarWeeks.map((week) => (
            <ForceLTRRow key={week[0]?.date.toString() ?? 'week'}>
              {week.map(({ date, label }) => (
                <HistoryCalendarDay
                  key={date.toString()}
                  sessions={sessionsByDate.get(date.toString()) ?? []}
                  day={date}
                  label={label}
                  today={today}
                  onPress={() => handleDayPress(date)}
                  onLongPress={() => handleDayLongPress(date)}
                />
              ))}
            </ForceLTRRow>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}

function HistoryCalendarDay(props: {
  day: LocalDate;
  label: string;
  today: LocalDate;
  sessions: Session[];
  onPress: () => void;
  onLongPress: () => void;
}) {
  const isFuture = props.day.isAfter(props.today);
  const hasSessions = props.sessions.length > 0;
  const isTodayWithNoSessions = props.day.equals(props.today) && !hasSessions;
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 1000,
        overflow: 'hidden',
        alignItems: 'center',
      }}
    >
      <TouchableRipple
        onPress={props.onPress}
        onLongPress={props.onLongPress}
        disabled={isFuture}
        accessibilityLabel={props.day.toString()}
        style={{ padding: spacing[1], borderRadius: 1000, overflow: 'hidden' }}
      >
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            aspectRatio: '1/1',
            width: spacing[10],
            borderRadius: 1000,
            borderColor: isTodayWithNoSessions ? colors.primary : 'transparent',
            borderWidth: 1,
            backgroundColor: hasSessions ? colors.primary : 'transparent',
          }}
        >
          <SurfaceText
            style={{ textAlign: 'center' }}
            color={hasSessions ? 'onPrimary' : 'onSurface'}
          >
            {props.label}
          </SurfaceText>
        </View>
      </TouchableRipple>
    </View>
  );
}

function ForceLTRRow(props: { children: ReactNode }) {
  const rtl = I18nManager.isRTL;
  return (
    <View style={{ flexDirection: rtl ? 'row-reverse' : 'row' }}>
      {props.children}
    </View>
  );
}
