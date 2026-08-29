import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import {
  ScreenHeading,
  SectionHeading,
} from '@/components/presentation/foundation/screen-heading';
import { gainsLabRadii } from '@/components/presentation/foundation/gainslab-ui';
import { AppIconSource } from '@/components/presentation/foundation/ms-icon-source';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { useAppSelector } from '@/store';
import { selectActiveProgram } from '@/store/program';
import { T, useTranslate } from '@tolgee/react';
import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Card, Text, Dialog, Icon, List, Portal } from 'react-native-paper';
import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import * as Application from 'expo-application';
import { useDispatch } from 'react-redux';
import { copyLogs } from '@/store/app';

export default function Settings() {
  const { t } = useTranslate();
  const { colors } = useAppTheme();
  const { push } = useRouter();
  const [appInfoOpen, setAppInfoOpen] = useState(false);
  const dispatch = useDispatch();
  const activeProgram = useAppSelector(selectActiveProgram);

  const openUrl = (url: string) => {
    void Linking.canOpenURL(url).then(() => Linking.openURL(url));
  };

  const appVersion =
    Application.nativeApplicationVersion ??
    Application.nativeBuildVersion ??
    'Unknown';
  const bugReportUrl = `https://github.com/gabsvm/LiftLog/issues/new?labels=bug&app-version=${encodeURIComponent(appVersion)}&platform=${Platform.OS}&os-version=${Platform.Version}`;

  return (
    <FullHeightScrollView
      contentContainerStyle={styles.content}
      scrollStyle={{ paddingHorizontal: spacing.pageHorizontalMargin }}
    >
      <Stack.Screen
        options={{ title: t('navigation.more'), headerShown: false }}
      />
      <ScreenHeading
        title={t('navigation.more')}
        subtitle={t('screen.settings.subtitle')}
      />

      <View style={styles.group}>
        <SectionHeading title={t('home.plan.section')} />
        <Card
          mode="contained"
          onPress={() => push('/settings/program-list')}
          style={[
            styles.activePlanCard,
            { backgroundColor: colors.surfaceContainerHigh },
          ]}
        >
          <Card.Content style={styles.activePlanContent}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                variant="labelSmall"
                style={{
                  color: colors.primary,
                  fontWeight: '800',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {t('home.plan.section')}
              </Text>
              <Text
                variant="titleLarge"
                numberOfLines={1}
                style={{ marginTop: spacing[1], fontWeight: '800' }}
              >
                {activeProgram.name}
              </Text>
              <Text
                variant="bodySmall"
                numberOfLines={1}
                style={{
                  marginTop: spacing[1],
                  color: colors.onSurfaceVariant,
                }}
              >
                {t('plan.manage.subtitle')}
              </Text>
            </View>
            <Icon source="chevronRight" size={24} color={colors.primary} />
          </Card.Content>
        </Card>
        <SettingsCard>
          <List.Item
            onPress={() => push('/settings/manage-exercises')}
            title={t('exercise.manage.button')}
            description={t('exercise.manage.subtitle')}
            left={(props) => <List.Icon icon={'directionsRun'} {...props} />}
          />
        </SettingsCard>
      </View>

      <GainsLabTools
        openPlanner={() => push('/settings/ai/planner')}
        openImport={() => push('/settings/import-ironlog')}
        openFeed={() => push('/feed')}
      />

      <SettingsGroup title={t('settings.account_data.title')}>
        <List.Item
          onPress={() => push('/settings/cloud-sync')}
          title={t('settings.cloud_sync.title')}
          description={t('settings.cloud_sync.subtitle')}
          left={(props) => <List.Icon icon={'cloudUpload'} {...props} />}
        />
        <List.Item
          onPress={() => push('/settings/backup-and-restore')}
          title={t('backup.export_backup_restore.title')}
          description={t('backup.export_backup_restore.subtitle')}
          left={(props) => (
            <List.Icon icon={'settingsBackupRestore'} {...props} />
          )}
        />
      </SettingsGroup>

      <SettingsGroup title={t('settings.app_configuration.title')}>
        <List.Item
          testID="appConfiguration"
          onPress={() => push('/settings/app-configuration')}
          title={t('settings.appearance.title')}
          description={t('settings.app_configuration.subtitle')}
          left={(props) => <List.Icon icon={'settings'} {...props} />}
        />
        <List.Item
          testID="localization"
          onPress={() => push('/settings/localization')}
          title={t('settings.localisation.title')}
          description={t('settings.localisation.subtitle')}
          left={(props) => <List.Icon icon={'language'} {...props} />}
        />
        <List.Item
          onPress={() => push('/settings/notifications')}
          title={t('settings.notifications.title')}
          description={t('settings.notifications.subtitle')}
          left={(props) => <List.Icon icon={'notifications'} {...props} />}
        />
      </SettingsGroup>

      <SettingsGroup title={t('settings.support.title')}>
        <List.Item
          onPress={() => openUrl('https://github.com/gabsvm/LiftLog/issues/new')}
          title={t('settings.feature_request.title')}
          description={t('settings.feature_request.subtitle')}
          left={(props) => <List.Icon icon={'star'} {...props} />}
        />
        <List.Item
          onPress={() => openUrl(bugReportUrl)}
          title={t('settings.bug_report.title')}
          description={t('settings.bug_report.subtitle')}
          left={(props) => <List.Icon icon={'bugReport'} {...props} />}
        />
        <List.Item
          onPress={() => dispatch(copyLogs())}
          title={t('settings.copy_logs.title')}
          description={t('settings.copy_logs.subtitle')}
          left={(props) => <List.Icon icon={'terminal'} {...props} />}
        />
        <List.Item
          onPress={() => setAppInfoOpen(true)}
          title={t('settings.app_info.title')}
          description={t('settings.app_info.subtitle')}
          left={(props) => <List.Icon icon={'info'} {...props} />}
        />
      </SettingsGroup>

      {appInfoOpen ? (
        <Portal>
          <Dialog visible onDismiss={() => setAppInfoOpen(false)}>
            <Dialog.Title>
              <T keyName="settings.app_info.title" />
            </Dialog.Title>
            <Dialog.Content>
              <Text>{t('settings.app_info.subtitle')}</Text>
              <Text style={{ marginTop: spacing[3] }}>
                LiftLog · AGPL-3.0 ·{' '}
                <Link
                  style={{ color: colors.primary, fontWeight: 'bold' }}
                  href="https://github.com/gabsvm/LiftLog"
                >
                  <Icon size={16} source={'share'} color={colors.primary} />
                  GitHub
                </Link>
              </Text>
              <Text style={{ marginTop: spacing[2] }}>
                GainsLab {appVersion}
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setAppInfoOpen(false)}>
                <T keyName="generic.close.button" />
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      ) : null}
    </FullHeightScrollView>
  );
}

function GainsLabTools({
  openPlanner,
  openImport,
  openFeed,
}: {
  openPlanner: () => void;
  openImport: () => void;
  openFeed: () => void;
}) {
  const { t } = useTranslate();
  return (
    <View style={styles.group}>
      <SectionHeading title="GainsLab" />
      <View style={styles.toolGrid}>
        <ToolTile
          icon="bolt"
          title={t('ai.planner.title')}
          onPress={openPlanner}
        />
        <ToolTile
          icon="backup"
          title={t('settings.import_ironlog.title')}
          onPress={openImport}
        />
      </View>
      <SettingsCard>
        <List.Item
          onPress={openFeed}
          title={t('feed.feed.title')}
          description={t('feed.explanation.body')}
          left={(props) => <List.Icon icon={'forum'} {...props} />}
        />
      </SettingsCard>
    </View>
  );
}

function ToolTile({
  icon,
  title,
  onPress,
}: {
  icon: AppIconSource;
  title: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Card
      mode="contained"
      onPress={onPress}
      style={[
        styles.toolTile,
        { backgroundColor: colors.surfaceContainerHigh },
      ]}
    >
      <Card.Content style={styles.toolTileContent}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: gainsLabRadii.compact,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceContainerHighest,
          }}
        >
          <Icon source={icon} size={21} color={colors.primary} />
        </View>
        <Text variant="titleMedium" numberOfLines={2} style={styles.toolTitle}>
          {title}
        </Text>
      </Card.Content>
    </Card>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <SectionHeading title={title} />
      <SettingsCard>{children}</SettingsCard>
    </View>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <Card
      mode="contained"
      style={[styles.card, { backgroundColor: colors.surfaceContainer }]}
    >
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
  },
  group: {
    gap: spacing[2],
  },
  card: {
    borderRadius: gainsLabRadii.card,
    overflow: 'hidden',
  },
  activePlanCard: {
    borderRadius: gainsLabRadii.card,
    overflow: 'hidden',
  },
  activePlanContent: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  toolGrid: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  toolTile: {
    flex: 1,
    minWidth: 0,
    borderRadius: gainsLabRadii.card,
  },
  toolTileContent: {
    minHeight: 112,
    justifyContent: 'space-between',
    gap: spacing[3],
    padding: spacing[4],
  },
  toolTitle: {
    fontWeight: '800',
    lineHeight: 21,
  },
});
