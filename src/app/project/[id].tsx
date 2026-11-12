import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarBadge } from '@/components/AvatarBadge';
import { DecorativeArt } from '@/components/DecorativeArt';
import { EditItemSheet, EditProjectSheet } from '@/components/editSheets';
import { AppText } from '@/components/ui/Text';
import {
    isEligibleItem,
    itemAmounts,
    projectProgress,
    projectTotalsByCurrency,
    type CurrencyTotals,
} from '@/db/derived';
import {
    archiveItem,
    listItemsByProject,
    updateItem,
} from '@/db/repositories/items';
import { listPaymentsForItem } from '@/db/repositories/payments';
import { archiveProject, getProject, updateProject } from '@/db/repositories/projects';
import { cancelItemReminders } from '@/db/repositories/reminders';
import type { ProjectItem as Item, Project } from '@/db/types';
import { formatDueDate, formatDueTime, isOverdue } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { reconcileReminders } from '@/features/reminders/scheduler';
import { exportProjectReport } from '@/features/reports/projectReport';
import { useChatFormStore } from '@/store/chatForm';
import { getProjectColor, onColorFor, softTint } from '@/theme/projectColor';
import { colors, elevation, radii, spacing } from '@/theme/tokens';

type Filter = 'open' | 'done' | 'all';

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'Open', value: 'open' },
  { label: 'Done', value: 'done' },
  { label: 'All', value: 'all' },
];

function paymentChip(status: string): { label: string; color: string } | null {
  switch (status) {
    case 'unpaid': return { label: 'Unpaid', color: colors.textSecondary };
    case 'partially_paid': return { label: 'Part paid', color: colors.warning };
    case 'paid': return { label: 'Paid', color: colors.success };
    case 'overpaid': return { label: 'Overpaid', color: colors.accent };
    default: return null;
  }
}

function matchesFilter(item: Item, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'done') return item.completion_status === 'completed';
  return item.completion_status !== 'completed' && item.completion_status !== 'cancelled';
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<Filter>('open');
  const [tick, setTick] = useState(0);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const openForm = useChatFormStore((s) => s.openForm);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        setProject(getProject(id));
        setItems(listItemsByProject(id));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- tick retriggers reload
    }, [id, tick]),
  );

  const color = getProjectColor(project?.color_key);
  const onColor = onColorFor(color);
  const progress = useMemo(() => projectProgress(items), [items]);
  const totals = useMemo(() => {
    const payments = new Map<string, ReturnType<typeof listPaymentsForItem>>();
    for (const i of items) payments.set(i.id, listPaymentsForItem(i.id));
    return projectTotalsByCurrency(items, payments);
  }, [items]);
  const hasExpected = items.some((i) => i.expected_amount_minor != null && isEligibleItem(i));
  const visibleItems = useMemo(() => items.filter((i) => matchesFilter(i, filter)), [items, filter]);

  if (!project) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <AppText type="heading">Project not found</AppText>
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backBtn}>
            <AppText type="label" color={colors.accent}>Back</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const archived = project.status === 'archived';

  const confirmDone = (item: Item) => {
    const amounts = itemAmounts(item, listPaymentsForItem(item.id));
    const outstanding = amounts.outstandingMinor ?? 0;
    const doComplete = () => {
      updateItem(item.id, { completion_status: 'completed' });
      cancelItemReminders(item.id);
      void reconcileReminders();
      reload();
    };
    if (outstanding > 0) {
      Alert.alert(
        `${formatMoney(outstanding, item.currency_code)} still unpaid`,
        'You can record a payment now, or mark the item done anyway.',
        [
          { text: 'Add payment', onPress: () => openPayment(item) },
          { text: 'Mark done anyway', onPress: doComplete },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } else {
      doComplete();
    }
  };

  const openPayment = (item: Item) => {
    const amounts = itemAmounts(item, listPaymentsForItem(item.id));
    openForm(
      'newPayment',
      {
        itemId: item.id,
        projectId: item.project_id,
        currency: item.currency_code,
        outstanding: amounts.outstandingMinor != null ? formatMoney(amounts.outstandingMinor, item.currency_code) : '',
        outstandingMinor: amounts.outstandingMinor ?? 0,
      },
      { onResult: (r) => { if (r) reload(); } },
    );
  };

  const openNewItem = () => {
    openForm(
      'newItem',
      {
        projectId: project.id,
        currency: project.currency_code,
        project: { currency_code: project.currency_code },
        usedAvatarKeys: items.map((i) => i.avatar_key),
      },
      { onResult: (r) => { if (r) reload(); } },
    );
  };

  const itemMenu = (item: Item) => {
    const done = item.completion_status === 'completed';
    Alert.alert(item.title, undefined, [
      { text: 'Edit item', onPress: () => setEditItem(item) },
      {
        text: done ? 'Reopen' : 'Mark done',
        onPress: () => {
          if (done) {
            updateItem(item.id, { completion_status: 'open' });
            reload();
          } else {
            confirmDone(item);
          }
        },
      },
      { text: 'Archive', style: 'destructive', onPress: () => { archiveItem(item.id); reload(); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const exportPdf = async () => {
    try {
      const uri = await exportProjectReport(project.id);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${project.name} report`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Report ready', `Saved to ${uri}`);
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Could not create the PDF.');
    }
  };

  const projectMenu = () => {
    const act = (fn: () => void) => () => { fn(); reload(); };
    Alert.alert(project.name, undefined, [
      { text: 'Edit project', onPress: () => setEditProjectOpen(true) },
      { text: 'Export PDF report', onPress: () => void exportPdf() },
      ...(project.status === 'active'
        ? [{ text: 'Put on hold', onPress: act(() => updateProject(project.id, { status: 'on_hold' })) }]
        : project.status === 'on_hold'
          ? [{ text: 'Mark active', onPress: act(() => updateProject(project.id, { status: 'active' })) }]
          : []),
      { text: 'Mark completed', onPress: act(() => updateProject(project.id, { status: 'completed' })) },
      archived
        ? { text: 'Restore', onPress: act(() => updateProject(project.id, { status: 'active' })) }
        : { text: 'Archive', style: 'destructive' as const, onPress: act(() => archiveProject(project.id)) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={[styles.header, { backgroundColor: color.hex }]}>
          <DecorativeArt seed={project.id} colorKey={project.color_key} variant="header" />
          <SafeAreaView edges={['top']}>
            <View style={styles.headerTopRow}>
              <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
                <AppText type="heading" color={onColor}>‹</AppText>
              </Pressable>
              <Pressable onPress={projectMenu} accessibilityRole="button" accessibilityLabel="Project options" style={styles.iconBtn}>
                <AppText type="heading" color={onColor}>⋯</AppText>
              </Pressable>
            </View>
            <AppText type="display" color={onColor} style={styles.projectName} numberOfLines={2}>
              {project.name}
            </AppText>
            <AppText type="label" color={onColor} style={{ opacity: 0.85 }}>
              {project.target_end_date ? `Target ${formatDueDate(project.target_end_date)}` : 'No target date'}
            </AppText>
            {progress.eligible > 0 ? (
              <View style={styles.progressWrap}>
                <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                  <View style={[styles.progressFill, { backgroundColor: onColor, width: `${Math.round((progress.done / progress.eligible) * 100)}%` }]} />
                </View>
                <AppText type="caption" color={onColor} style={{ opacity: 0.9 }}>
                  {progress.done} of {progress.eligible} items done
                </AppText>
              </View>
            ) : (
              <AppText type="caption" color={onColor} style={[styles.noItems, { opacity: 0.85 }]}>No items yet</AppText>
            )}
          </SafeAreaView>
        </View>

        {/* summary card */}
        {hasExpected && totals.size > 0 ? (
          <View style={[styles.summaryCard, elevation.card]}>
            {[...totals.entries()].map(([currency, t]: [string, CurrencyTotals]) => (
              <View key={currency} style={styles.summaryInner}>
                <SummaryCol label="Planned" value={formatMoney(t.plannedMinor, currency)} />
                <View style={styles.summaryDivider} />
                <SummaryCol label="Paid" value={formatMoney(t.paidMinor, currency)} valueColor={colors.success} />
                <View style={styles.summaryDivider} />
                <SummaryCol label="Outstanding" value={formatMoney(t.outstandingMinor, currency)} valueColor={t.outstandingMinor > 0 ? colors.danger : colors.textPrimary} />
                {t.overpaidMinor > 0 ? (
                  <AppText type="caption" color={colors.accent} style={styles.overpaid}>
                    Overpaid {formatMoney(t.overpaidMinor, currency)}
                  </AppText>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* items header */}
        <View style={styles.itemsHeader}>
          <AppText type="heading">Items</AppText>
          <View style={styles.segmented}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[styles.segBtn, filter === f.value && { backgroundColor: colors.textPrimary }]}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === f.value }}
              >
                <AppText type="label" color={filter === f.value ? '#FFFFFF' : 'textSecondary'}>{f.label}</AppText>
              </Pressable>
            ))}
          </View>
        </View>

        {archived ? (
          <View style={styles.archiveBanner}>
            <AppText type="label" color={colors.textSecondary}>This project is archived — read only.</AppText>
            <Pressable onPress={() => { updateProject(project.id, { status: 'active' }); reload(); }} accessibilityRole="button">
              <AppText type="label" color={colors.accent}>Restore</AppText>
            </Pressable>
          </View>
        ) : null}

        {/* item list */}
        {visibleItems.length === 0 ? (
          <View style={styles.empty}>
            <AppText type="body" color="textSecondary">No items yet</AppText>
            <AppText type="caption" color="textTertiary">Add milestones, tasks or costs for this project.</AppText>
          </View>
        ) : (
          visibleItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              projectColorKey={project.color_key}
              onPress={() => router.push(`/item/${item.id}` as never)}
              onLongPress={() => itemMenu(item)}
            />
          ))
        )}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* FAB */}
      {!archived ? (
        <Pressable
          onPress={openNewItem}
          accessibilityRole="button"
          accessibilityLabel="Add item"
          style={[styles.fab, { backgroundColor: color.hex }]}
        >
          <AppText type="label" color={onColor}>+ Add item</AppText>
        </Pressable>
      ) : null}

      <EditProjectSheet
        visible={editProjectOpen}
        project={project}
        onClose={() => setEditProjectOpen(false)}
        onSaved={reload}
      />
      <EditItemSheet
        visible={Boolean(editItem)}
        item={editItem}
        onClose={() => setEditItem(null)}
        onSaved={reload}
      />
    </View>
  );
}

function SummaryCol({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.summaryCol}>
      <AppText type="caption" color="textSecondary">{label}</AppText>
      <AppText type="heading" color={valueColor ?? 'textPrimary'}>{value}</AppText>
    </View>
  );
}

function ItemRow({
  item,
  projectColorKey,
  onPress,
  onLongPress,
}: {
  item: Item;
  projectColorKey: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const payments = listPaymentsForItem(item.id);
  const amounts = itemAmounts(item, payments);
  const chip = amounts.expectedMinor != null ? paymentChip(amounts.paymentStatus) : null;
  const overdue = isOverdue(item.due_date, item.completion_status);
  const done = item.completion_status === 'completed';
  const color = getProjectColor(projectColorKey);

  const dueText = [
    item.due_date ? formatDueDate(item.due_date) : null,
    item.due_time ? formatDueTime(item.due_time) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, due ${dueText || 'no date'}, ${amounts.expectedMinor != null ? formatMoney(amounts.expectedMinor, item.currency_code) : 'no cost'}, ${chip?.label ?? ''}, ${done ? 'done' : 'open'}`}
      style={({ pressed }) => [styles.itemRow, pressed && { opacity: 0.7 }]}
    >
      <AvatarBadge avatarKey={item.avatar_key} projectColor={color.hex} completed={done} />
      <View style={styles.itemBody}>
        <AppText
          type="heading"
          numberOfLines={1}
          style={done ? { textDecorationLine: 'line-through', color: colors.textTertiary } : undefined}
        >
          {item.title}
        </AppText>
        {dueText ? (
          <AppText type="caption" color={overdue ? 'danger' : 'textSecondary'}>
            {overdue ? 'OVERDUE · ' : ''}
            {dueText}
          </AppText>
        ) : null}
      </View>
      <View style={styles.itemTrailing}>
        {amounts.expectedMinor != null ? (
          <AppText type="label">{formatMoney(amounts.expectedMinor, item.currency_code)}</AppText>
        ) : null}
        {chip ? (
          <View style={[styles.chip, { backgroundColor: softTint(chip.color) }]}>
            <AppText type="caption" color={chip.color}>{chip.label}</AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  backBtn: { padding: spacing.md },
  scroll: { paddingBottom: spacing.lg },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.huge,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    overflow: 'hidden',
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectName: { marginBottom: spacing.xs },
  progressWrap: { marginTop: spacing.lg, gap: spacing.sm },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  noItems: { marginTop: spacing.lg },
  summaryCard: {
    marginHorizontal: spacing.xl,
    marginTop: -spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  summaryInner: { flexDirection: 'row', alignItems: 'center' },
  summaryCol: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: colors.border },
  overpaid: { textAlign: 'center', marginTop: spacing.sm },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    padding: 3,
  },
  segBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill, minHeight: 32, justifyContent: 'center' },
  archiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  empty: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.xl },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  itemBody: { flex: 1, gap: 2 },
  itemTrailing: { alignItems: 'flex-end', gap: spacing.xs },
  chip: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    minHeight: 48,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.floating,
  },
});
