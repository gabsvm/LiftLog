import SelectButton, {
  SelectButtonOption,
} from '@/components/presentation/foundation/select-button';
import { useFormatDate } from '@/hooks/useFormatDate';
import { isLocalDateRangeEqual, LocalDateRange } from '@/models/time-models';
import { convert, LocalDate, nativeJs, Period } from '@js-joda/core';
import { useTranslate } from '@tolgee/react';
import { useState } from 'react';
import { DatePickerModal } from 'react-native-paper-dates';

type TimePeriodSelectorProps = {
  timePeriod: LocalDateRange | 'all-time';
  setTimePeriod: (value: LocalDateRange | 'all-time') => void;
};

export function TimePeriodSelector({
  timePeriod,
  setTimePeriod,
}: TimePeriodSelectorProps) {
  const today = LocalDate.now();
  const [timeRangeSelectorOpen, setTimeRangeSelectorOpen] = useState(false);
  const { t } = useTranslate();
  const formatDate = useFormatDate();
  const timeOptions: SelectButtonOption<
    LocalDateRange | 'all-time' | 'custom'
  >[] = [
    {
      label: t('time_period_select.num_days.label', { count: '7' }),
      value: getPeriod(Period.ofDays(7), today),
    },
    {
      label: t('time_period_select.num_days.label', { count: '14' }),
      value: getPeriod(Period.ofDays(14), today),
    },
    {
      label: t('time_period_select.num_days.label', { count: '30' }),
      value: getPeriod(Period.ofDays(30), today),
    },
    {
      label: t('time_period_select.num_days.label', { count: '90' }),
      value: getPeriod(Period.ofDays(90), today),
    },
    {
      label: t('time_period_select.num_days.label', { count: '180' }),
      value: getPeriod(Period.ofDays(180), today),
    },
    {
      label: t('time_period_select.num_days.label', { count: '365' }),
      value: getPeriod(Period.ofDays(365), today),
    },
    {
      label: t('time_period_select.all_time.label'),
      value: 'all-time',
    },
    {
      label: t('time_period_select.custom.label'),
      value: 'custom',
    },
  ];
  const nonCustomValues: SelectButtonOption<LocalDateRange>[] =
    timeOptions.filter(
      (x): x is SelectButtonOption<LocalDateRange> =>
        x.value !== 'custom' && x.value !== 'all-time',
    );

  function handleCustomRangePicked(params: {
    startDate: Date | undefined;
    endDate: Date | undefined;
  }) {
    setTimeRangeSelectorOpen(false);
    if (!params.startDate || !params.endDate) {
      return;
    }
    setTimePeriod({
      from: nativeJs(params.startDate).toLocalDate(),
      to: nativeJs(params.endDate).toLocalDate(),
    });
  }

  return (
    <>
      <SelectButton
        testID="stats-time-selector"
        value={timePeriod}
        buttonProps={{ mode: 'contained-tonal' }}
        options={timeOptions}
        renderLabel={() => {
          if (timePeriod === 'all-time') {
            return t('time_period_select.all_time.label');
          }
          const selectedOption = nonCustomValues.find((x) =>
            isLocalDateRangeEqual(x.value, timePeriod),
          );

          if (!selectedOption) {
            const dateOptions: Intl.DateTimeFormatOptions = {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            };
            return `${formatDate(timePeriod.from, dateOptions)} – ${formatDate(
              timePeriod.to,
              dateOptions,
            )}`;
          }
          return selectedOption.label;
        }}
        onChange={(value) => {
          if (value === 'custom') {
            setTimeRangeSelectorOpen(true);
          } else {
            setTimePeriod(value);
          }
        }}
      />
      {timeRangeSelectorOpen ? (
        <DatePickerModal
          locale="default"
          mode="range"
          visible
          onDismiss={() => setTimeRangeSelectorOpen(false)}
          onConfirm={handleCustomRangePicked}
          startDate={
            timePeriod === 'all-time'
              ? undefined
              : convert(timePeriod.from).toDate()
          }
          endDate={
            timePeriod === 'all-time'
              ? undefined
              : convert(timePeriod.to).toDate()
          }
        />
      ) : null}
    </>
  );
}

function getPeriod(period: Period, today: LocalDate) {
  return {
    from: today.minus(period),
    to: today,
  };
}
