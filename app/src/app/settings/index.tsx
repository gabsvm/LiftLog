import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import {
  ScreenHeading,
  SectionHeading,
} from '@/components/presentation/foundation/screen-heading';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
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
        title={t('settings.settings.title')}
        subtitle={t('screen.settings.subtitle')}
      />

      <SettingsGroup title={t('home.plan.section')}>
        <List.Item
          onPress={() => push('/settings/program-list')}
          title={t('plan.manage.title')}
          description={t('plan.manage.subtitle')}
          left={(props) => <List.Icon icon={'assignment'} {...props} />}
        />
        <List.Item
          onPress={() => push('/settings/manage-exercises')}
          title={t('exercise.manage.button')}
          description={t('exercise.manage.subtitle')}
          left={(props) => <List.Icon icon={'directionsRun'} {...props} />}
        />
      </SettingsGroup>

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

      <SettingsCard>
        <List.Item
          onPress={() => push('/settings/ai/planner')}
          title={t('ai.planner.title')}
          description={t('ai.planner.subtitle')}
          left={(props) => <List.Icon icon={'bolt'} {...props} />}
        />
        <List.Item
          onPress={() => push('/settings/import-ironlog')}
          title={t('settings.import_ironlog.title')}
          description={t('settings.import_ironlog.subtitle')}
          left={(props) => <List.Icon icon={'backup'} {...props} />}
        />
        <List.Item
          onPress={() => push('/feed')}
          title={t('feed.feed.title')}
          description={t('feed.explanation.body')}
          left={(props) => <List.Icon icon={'forum'} {...props} />}
        />
      </SettingsCard>

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
    gap: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
  },
  group: {
    gap: spacing[2],
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
});
