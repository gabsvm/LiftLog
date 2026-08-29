import { LocalDate } from '@js-joda/core';
import { useAppSelector } from '@/store';
import { useCallback } from 'react';

export function useFormatDate(): (
  date: LocalDate,
  opts: Intl.DateTimeFormatOptions,
) => string {
  const locale = useAppSelector((x) => x.settings.preferredLanguage);
  return useCallback(
    (date: LocalDate, opts: Intl.DateTimeFormatOptions) =>
      new Date(
        date.year(),
        date.month().ordinal(),
        date.dayOfMonth(),
      ).toLocaleString(locale, opts),
    [locale],
  );
}
