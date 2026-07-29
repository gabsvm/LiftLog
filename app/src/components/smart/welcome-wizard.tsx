import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import ListSwitch from '@/components/presentation/foundation/list-switch';
import Icon from '@/components/presentation/foundation/gesture-wrappers/icon';
import { GainsLabWordmark } from '@/components/presentation/foundation/gainslab-brand';
import SelectButton, {
  SelectButtonOption,
} from '@/components/presentation/foundation/select-button';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { supportedLanguages } from '@/services/tolgee';
import { useAppSelector } from '@/store';
import {
  setFirstDayOfWeek,
  setPreferredLanguage,
  setRestNotifications,
  setShowFeed,
  setUseImperialUnits,
  setWelcomeWizardCompleted,
} from '@/store/settings';
import { getDateOnDay } from '@/utils/format-date';
import { DayOfWeek } from '@js-joda/core';
import { useTranslate } from '@tolgee/react';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, List, Portal, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { useFormatDate } from '@/hooks/useFormatDate';
import { requestPermissionsAsync } from 'expo-notifications';
import { selectionAsync } from 'expo-haptics';
import { HealthExportSwitch } from './health-export-switch';

export function WelcomeWizard() {
  const notificationsEnabled = useAppSelector(
    (x) => x.settings.restNotifications,
  );
  const formatDate = useFormatDate();
  const daysOfWeekOptions: SelectButtonOption<DayOfWeek>[] = [
    {
      value: DayOfWeek.SUNDAY,
      label: formatDate(getDateOnDay(DayOfWeek.SUNDAY), { weekday: 'long' }),
    },
    {
      value: DayOfWeek.MONDAY,
      label: formatDate(getDateOnDay(DayOfWeek.MONDAY), { weekday: 'long' }),
    },
    {
      value: DayOfWeek.TUESDAY,
      label: formatDate(getDateOnDay(DayOfWeek.TUESDAY), { weekday: 'long' }),
    },
    {
      value: DayOfWeek.WEDNESDAY,
      label: formatDate(getDateOnDay(DayOfWeek.WEDNESDAY), { weekday: 'long' }),
    },
    {
      value: DayOfWeek.THURSDAY,
      label: formatDate(getDateOnDay(DayOfWeek.THURSDAY), { weekday: 'long' }),
    },
    {
      value: DayOfWeek.FRIDAY,
      label: formatDate(getDateOnDay(DayOfWeek.FRIDAY), { weekday: 'long' }),
    },
    {
      value: DayOfWeek.SATURDAY,
      label: formatDate(getDateOnDay(DayOfWeek.SATURDAY), { weekday: 'long' }),
    },
  ];

  const { t } = useTranslate();
  const dispatch = useDispatch();
  const settings = useAppSelector((state) => state.settings);
  const welcomeWizardCompleted = settings.welcomeWizardCompleted;
  const { colors } = useAppTheme();
  const [currentPage, setCurrentPage] = useState(0);
  const languageOptions: SelectButtonOption<string | undefined>[] = useMemo(
    () => [
      {
        value: undefined,
        label: t('settings.system_default.label'),
      },
      ...supportedLanguages.map((x) => ({ value: x.code, label: x.label })),
    ],
    [t],
  );

  const totalPages = 3;

  const handleNext = async () => {
    await selectionAsync();
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      dispatch(setWelcomeWizardCompleted(true));
      if (notificationsEnabled) {
        await requestPermissionsAsync();
      }
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const renderWelcomePage = () => (
    <View style={styles.pageContent}>
      <View style={styles.brand}>
        <GainsLabWordmark />
      </View>
      <View style={styles.headerSection}>
        <Text variant="displaySmall" style={styles.pageTitle}>
          {t('onboarding.welcome.title')}
        </Text>
        <Text
          variant="bodyLarge"
          style={[styles.pageSubtitle, { color: colors.onSurfaceVariant }]}
        >
          {t('onboarding.welcome.subtitle')}
        </Text>
      </View>
      <View style={styles.featureStack}>
        <Feature
          icon="edit"
          title={t('onboarding.feature.track.title')}
          body={t('onboarding.feature.track.body')}
        />
        <Feature
          icon="analytics"
          title={t('onboarding.feature.test.title')}
          body={t('onboarding.feature.test.body')}
        />
        <Feature
          icon="trendingUp"
          title={t('onboarding.feature.grow.title')}
          body={t('onboarding.feature.grow.body')}
        />
      </View>
    </View>
  );

  const renderLocalizationPage = () => (
    <View style={styles.pageContent}>
      <View style={styles.headerSection}>
        <Text variant="headlineMedium" style={styles.pageTitle}>
          {t('onboarding.preferences.title')}
        </Text>
        <Text variant="bodyLarge" style={styles.pageSubtitle}>
          {t('onboarding.preferences.subtitle')}
        </Text>
      </View>

      <View style={styles.settingsSection}>
        <ListSwitch
          headline={t('settings.use_imperial_units.label')}
          supportingText={t('settings.use_imperial_units.subtitle')}
          value={settings.useImperialUnits}
          onValueChange={(value) => dispatch(setUseImperialUnits(value))}
        />
        <List.Item
          title={t('settings.first_day_of_week.label')}
          description={t('settings.first_day_of_week.subtitle')}
          right={() => (
            <SelectButton
              value={settings.firstDayOfWeek}
              options={daysOfWeekOptions}
              onChange={(value) => dispatch(setFirstDayOfWeek(value))}
            />
          )}
        />
        <List.Item
          title={t('settings.set_language.button')}
          description={t('settings.set_language.subtitle')}
          right={() => (
            <SelectButton
              value={settings.preferredLanguage}
              options={languageOptions}
              onChange={(value) => dispatch(setPreferredLanguage(value))}
            />
          )}
        />
      </View>
    </View>
  );

  const renderNotificationsAndFeedPage = () => (
    <View style={styles.pageContent}>
      <View style={styles.headerSection}>
        <Text variant="headlineMedium" style={styles.pageTitle}>
          {t('onboarding.notifications_and_feed.title')}
        </Text>
        <Text variant="bodyLarge" style={styles.pageSubtitle}>
          {t('onboarding.notifications_and_feed.subtitle')}
        </Text>
      </View>

      <View style={styles.settingsSection}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {t('settings.notifications.title')}
        </Text>
        <ListSwitch
          headline={t('rest.notifications.title')}
          supportingText={t('rest.notifications.subtitle')}
          value={settings.restNotifications}
          onValueChange={(value) => dispatch(setRestNotifications(value))}
        />

        <Text
          variant="titleMedium"
          style={[styles.sectionTitle, styles.topSpacing]}
        >
          {t('feed.feed.title')}
        </Text>
        <ListSwitch
          headline={t('feed.show_feed.label')}
          supportingText={t('feed.show_feed.subtitle')}
          value={settings.showFeed}
          onValueChange={(value) => dispatch(setShowFeed(value))}
        />
        <HealthExportSwitch />
      </View>
    </View>
  );

  const renderPage = () => {
    switch (currentPage) {
      case 0:
        return renderWelcomePage();
      case 1:
        return renderLocalizationPage();
      case 2:
        return renderNotificationsAndFeedPage();
      default:
        return null;
    }
  };
  return (
    !welcomeWizardCompleted && (
      <Portal>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={styles.container}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {renderPage()}
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.pageIndicator}>
                {Array.from({ length: totalPages }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      currentPage === index && styles.activeDot,
                    ]}
                  />
                ))}
              </View>

              <View style={styles.buttonRow}>
                <Button
                  mode="text"
                  onPress={handlePrevious}
                  disabled={currentPage === 0}
                  style={styles.button}
                >
                  {t('generic.previous.button')}
                </Button>
                <Button
                  mode="contained"
                  testID="welcome-wizard-next"
                  onPress={() => void handleNext()}
                  style={styles.button}
                >
                  {currentPage === totalPages - 1
                    ? t('onboarding.get_started.button')
                    : t('generic.next.button')}
                </Button>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Portal>
    )
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
  scrollContent: {
    flexGrow: 1,
  },
  brand: {
    marginBottom: spacing[8],
  },
  headerSection: {
    marginBottom: spacing[6],
  },
  pageTitle: {
    fontWeight: '800',
    letterSpacing: -1.4,
    marginBottom: spacing[2],
  },
  pageSubtitle: {
    lineHeight: 25,
  },
  settingsSection: {
    gap: spacing[1],
  },
  featureStack: {
    gap: spacing[3],
  },
  sectionTitle: {
    marginBottom: spacing[2],
    marginTop: spacing[4],
    marginHorizontal: spacing.pageHorizontalMargin,
  },
  sectionDescription: {
    opacity: 0.7,
    marginBottom: spacing[4],
    marginHorizontal: spacing.pageHorizontalMargin,
  },
  topSpacing: {
    marginTop: spacing[6],
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    marginTop: 'auto',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.22)',
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  dot: {
    width: spacing[2],
    height: spacing[2],
    borderRadius: spacing[1],
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
  },
  activeDot: {
    backgroundColor: '#C6FF00',
    width: spacing[6],
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[4],
  },
  button: {
    flex: 1,
    minHeight: 48,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[1],
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function Feature({
  icon,
  title,
  body,
}: {
  icon: 'edit' | 'analytics' | 'trendingUp';
  title: string;
  body: string;
}) {
  const { colors } = useAppTheme();
  return (
    <Card
      mode="contained"
      style={{
        backgroundColor: colors.surfaceContainer,
        borderRadius: 18,
      }}
    >
      <Card.Content style={styles.feature}>
        <View
          style={[
            styles.featureIcon,
            { backgroundColor: colors.primaryContainer },
          ]}
        >
          <Icon source={icon} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" style={{ fontWeight: '700' }}>
            {title}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: colors.onSurfaceVariant, marginTop: spacing[0.5] }}
          >
            {body}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}
