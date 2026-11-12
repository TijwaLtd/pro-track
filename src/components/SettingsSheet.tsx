import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LATEST_SCHEMA_VERSION } from '../db/migrations';
import {
    getDefaultReminder,
    getLockTimeout,
    getWeekStartPref,
    setDefaultReminder,
    setLockTimeout,
    setWeekStartPref,
    type DefaultReminder,
    type LockTimeout,
    type WeekStart,
} from '../db/repositories/settings';
import { seedDemoData } from '../db/seed';
import {
    createBackup,
    inspectBackup,
    pickBackupFile,
    restoreBackup,
} from '../features/backup/backup';
import { colors, radii, spacing } from '../theme/tokens';
import { AppText } from './ui/Text';

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

function OptionRow<T extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.optionRow}>
      <AppText type="body" color="textPrimary" style={styles.optionLabel}>{label}</AppText>
      <View style={styles.optionBtns}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            style={[styles.optionBtn, value === o.value && styles.optionBtnActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: value === o.value }}
            accessibilityLabel={`${label}: ${o.label}`}
          >
            <AppText type="label" color={value === o.value ? '#FFFFFF' : 'textPrimary'}>{o.label}</AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Settings sheet per design/sheets.json#settings (export/About arrive in later phases). */
export function SettingsSheet({ visible, onClose, onChanged }: SettingsSheetProps) {
  const [lockTimeout, setLock] = useState<LockTimeout>(getLockTimeout());
  const [weekStart, setWeek] = useState<WeekStart>(getWeekStartPref());
  const [reminder, setReminder] = useState<DefaultReminder>(getDefaultReminder());
  const [backupBusy, setBackupBusy] = useState(false);

  const onExport = async () => {
    setBackupBusy(true);
    try {
      const zipUri = await createBackup();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(zipUri, {
          mimeType: 'application/zip',
          dialogTitle: 'Export ProTrack backup',
          UTI: 'public.zip',
        });
      } else {
        Alert.alert('Backup created', `Saved to ${zipUri}`);
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Could not create backup.');
    } finally {
      setBackupBusy(false);
    }
  };

  const onRestore = async () => {
    const zipUri = await pickBackupFile();
    if (!zipUri) return;
    setBackupBusy(true);
    try {
      const preview = await inspectBackup(zipUri);
      const created = preview.manifest.createdAt
        ? new Date(preview.manifest.createdAt).toLocaleString()
        : 'unknown date';
      Alert.alert(
        'Restore backup?',
        `Backup from ${created} (schema v${preview.manifest.schemaVersion}, ${preview.evidenceCount} evidence file${preview.evidenceCount === 1 ? '' : 's'}).\n\nThis will replace ALL data on this device.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                await restoreBackup(zipUri);
                Alert.alert('Restore complete', 'Your backup has been restored.');
                onChanged?.();
              } catch (e) {
                Alert.alert('Restore failed', e instanceof Error ? e.message : 'Could not restore backup.');
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Invalid backup', e instanceof Error ? e.message : 'Could not read backup.');
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <View style={styles.handle} />
        <AppText type="heading" style={styles.title}>Settings</AppText>

        <OptionRow
          label="Lock after"
          value={lockTimeout}
          options={[
            { value: 'immediately', label: 'Immediately' },
            { value: '30s', label: '30 seconds' },
            { value: '1m', label: '1 minute' },
            { value: '5m', label: '5 minutes' },
          ]}
          onSelect={(v) => { setLockTimeout(v); setLock(v); onChanged?.(); }}
        />
        <OptionRow
          label="Week starts on"
          value={weekStart}
          options={[
            { value: 'monday', label: 'Mon' },
            { value: 'sunday', label: 'Sun' },
          ]}
          onSelect={(v) => { setWeekStartPref(v); setWeek(v); onChanged?.(); }}
        />
        <OptionRow
          label="Default reminder"
          value={reminder}
          options={[
            { value: 'at_due', label: 'At due time' },
            { value: '1h', label: '1 hour before' },
            { value: '1d', label: '1 day before' },
          ]}
          onSelect={(v) => { setDefaultReminder(v); setReminder(v); onChanged?.(); }}
        />

        <AppText type="label" color="textSecondary" style={styles.sectionLabel}>BACKUP</AppText>
        <Pressable
          onPress={onExport}
          disabled={backupBusy}
          style={styles.actionRow}
          accessibilityRole="button"
          accessibilityLabel="Export backup"
        >
          <AppText type="body" color="textPrimary">Export backup</AppText>
          <AppText type="caption" color="textSecondary">
            {backupBusy ? 'Working…' : 'Creates a zip of data and evidence you can save or share'}
          </AppText>
        </Pressable>
        <Pressable
          onPress={onRestore}
          disabled={backupBusy}
          style={styles.actionRow}
          accessibilityRole="button"
          accessibilityLabel="Restore backup"
        >
          <AppText type="body" color="textPrimary">Restore backup</AppText>
          <AppText type="caption" color="textSecondary">Replace all local data with a backup file</AppText>
        </Pressable>
        <Pressable
          onPress={() => {
            if (seedDemoData()) {
              Alert.alert('Demo data loaded', 'The sample maize project was added.');
              onChanged?.();
            } else {
              Alert.alert('Nothing to seed', 'Demo data only loads when there are no projects yet.');
            }
          }}
          style={styles.actionRow}
          accessibilityRole="button"
          accessibilityLabel="Load demo data"
        >
          <AppText type="body" color="textPrimary">Load demo data</AppText>
          <AppText type="caption" color="textSecondary">Adds the sample maize project (empty database only)</AppText>
        </Pressable>

        <View style={styles.optionRow}>
          <AppText type="body" color="textPrimary" style={styles.optionLabel}>About</AppText>
          <AppText type="caption" color="textSecondary">
            ProTrack v{Constants.expoConfig?.version ?? '1.0.0'} · schema v{LATEST_SCHEMA_VERSION}
          </AppText>
        </View>

        <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close settings">
          <AppText type="label" color={colors.accent}>DONE</AppText>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, padding: spacing.xl, gap: spacing.xl },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm },
  title: { marginBottom: spacing.sm },
  optionRow: { gap: spacing.sm },
  optionLabel: {},
  optionBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionBtn: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  optionBtnActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  sectionLabel: { letterSpacing: 1 },
  actionRow: { gap: spacing.xs, minHeight: 48, justifyContent: 'center' },
  closeBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: 'auto' },
});
