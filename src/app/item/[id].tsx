import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarBadge } from '@/components/AvatarBadge';
import { AvatarGlyph } from '@/components/AvatarGlyph';
import { DecorativeArt } from '@/components/DecorativeArt';
import { EditItemSheet, EditPaymentSheet } from '@/components/editSheets';
import { EvidenceViewer } from '@/components/EvidenceViewer';
import { AppText } from '@/components/ui/Text';
import { itemAmounts, type ItemAmounts } from '@/db/derived';
import { listActivityForItem } from '@/db/repositories/helpers';
import { archiveItem, getItem, updateItem } from '@/db/repositories/items';
import {
    addEvidenceToPayment,
    findDuplicateRawText,
    listEvidenceForPayment,
    listPaymentsForItem,
    voidPayment,
    type EvidenceInput,
} from '@/db/repositories/payments';
import { getProject } from '@/db/repositories/projects';
import { cancelItemReminders, listRemindersForItem, upsertItemReminder } from '@/db/repositories/reminders';
import type { ActivityLog, Payment, PaymentEvidence, PaymentMethod, Project, ProjectItem, Reminder } from '@/db/types';
import { ALL_AVATARS } from '@/domain/avatars';
import { formatDueDateLong, isOverdue } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import {
    evidenceFileExists,
    importEvidenceFile,
    resolveEvidenceUri,
    type PickedFile,
} from '@/features/evidence/files';
import { reconcileReminders } from '@/features/reminders/scheduler';
import { useChatFormStore } from '@/store/chatForm';
import { getProjectColor, onColorFor, softTint } from '@/theme/projectColor';
import { colors, components, elevation, radii, spacing } from '@/theme/tokens';

const METHOD_LABEL: Record<PaymentMethod, string> = {
  mpesa: 'M-Pesa',
  cash: 'Cash',
  bank: 'Bank',
  card: 'Card',
  other: 'Other',
};

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Unpaid', color: colors.textSecondary },
  partially_paid: { label: 'Part paid', color: colors.warning },
  paid: { label: 'Paid', color: colors.success },
  overpaid: { label: 'Overpaid', color: colors.accent },
  not_applicable: { label: '', color: colors.textSecondary },
};

function fmtPaidAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function reminderSummary(reminders: Reminder[], dueDate: string | null, dueTime: string | null): string {
  const enabled = reminders.filter((r) => r.enabled);
  if (enabled.length === 0) return dueDate ? 'No reminder' : '';
  const r = enabled[0];
  const when = new Date(r.scheduled_at);
  const whenStr = Number.isNaN(when.getTime()) ? '' : when.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const adv = r.advance_minutes ? (r.advance_minutes >= 60 ? `${Math.round(r.advance_minutes / 60)}h before` : `${r.advance_minutes}m before`) : '';
  return [whenStr, adv].filter(Boolean).join(' · ');
}

export default function ProjectItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ProjectItem | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [evidence, setEvidence] = useState<Record<string, PaymentEvidence[]>>({});
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [viewer, setViewer] = useState<{ payment: Payment; index: number } | null>(null);
  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [tick, setTick] = useState(0);
  const openForm = useChatFormStore((s) => s.openForm);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const it = getItem(id);
      setItem(it);
      if (it) {
        setProject(getProject(it.project_id));
        const pays = listPaymentsForItem(it.id);
        setPayments(pays);
        const ev: Record<string, PaymentEvidence[]> = {};
        for (const p of pays) ev[p.id] = listEvidenceForPayment(p.id);
        setEvidence(ev);
        setActivity(listActivityForItem(it.id));
        setReminders(listRemindersForItem(it.id));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- tick retriggers reload
    }, [id, tick]),
  );

  const color = getProjectColor(project?.color_key ?? item?.avatar_key);
  const onColor = onColorFor(color);
  const amounts: ItemAmounts | null = useMemo(
    () => (item ? itemAmounts(item, payments) : null),
    [item, payments],
  );
  const overdue = item ? isOverdue(item.due_date, item.completion_status) : false;
  const done = item?.completion_status === 'completed';
  const cancelled = item?.completion_status === 'cancelled';
  const readOnly = project?.status === 'archived';

  if (!item || !project) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <AppText type="heading">Item not found</AppText>
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backBtn}>
            <AppText type="label" color={colors.accent}>Back</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const complete = () => {
    updateItem(item.id, { completion_status: 'completed' });
    cancelItemReminders(item.id);
    void reconcileReminders();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reload();
  };

  const reopen = () => {
    updateItem(item.id, { completion_status: 'open' });
    reload();
  };

  const onPrimary = () => {
    if (done) return reopen();
    if (cancelled) return reopen();
    const outstanding = amounts?.outstandingMinor ?? 0;
    if (outstanding > 0) {
      Alert.alert(
        `${formatMoney(outstanding, item.currency_code)} still unpaid`,
        'You can record a payment now, or mark the item done anyway.',
        [
          { text: 'Add payment', onPress: () => openPayment() },
          { text: 'Mark done anyway', onPress: complete },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } else {
      complete();
    }
  };

  const openPayment = () => {
    openForm(
      'newPayment',
      {
        itemId: item.id,
        projectId: item.project_id,
        currency: item.currency_code,
        outstanding: amounts?.outstandingMinor != null ? formatMoney(amounts.outstandingMinor, item.currency_code) : '',
        outstandingMinor: amounts?.outstandingMinor ?? 0,
      },
      { onResult: (r) => { if (r) reload(); } },
    );
  };

  const toggleReminder = () => {
    if (reminders.some((r) => r.enabled)) {
      cancelItemReminders(item.id);
    } else if (item.due_date) {
      const due = new Date(`${item.due_date}T${item.due_time ?? '08:00'}:00`);
      if (Number.isNaN(due.getTime())) return;
      upsertItemReminder({
        project_item_id: item.id,
        scheduled_at: new Date(due.getTime() - 60 * 60_000).toISOString(),
        advance_minutes: 60,
      });
    }
    void reconcileReminders();
    reload();
  };

  const pickAvatar = () => setAvatarPickerOpen(true);

  const saveAvatar = (key: string) => {
    updateItem(item.id, { avatar_key: key });
    setAvatarPickerOpen(false);
    reload();
  };

  const itemMenu = () => {
    Alert.alert(item.title, undefined, [
      { text: 'Edit item', onPress: () => setEditItemOpen(true) },
      { text: cancelled ? 'Reopen' : done ? 'Reopen' : 'Mark done', onPress: done || cancelled ? reopen : onPrimary },
      { text: 'Archive', style: 'destructive', onPress: () => { archiveItem(item.id); router.back(); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const addEvidenceTo = async (paymentId: string) => {
    const img = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    let picked: PickedFile[] = [];
    if (!img.canceled) {
      picked = img.assets.map((a) => ({ uri: a.uri, fileName: a.fileName ?? a.uri.split('/').pop() ?? null, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? null, kind: 'image' as const }));
    } else {
      const doc = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['image/*', 'application/pdf', '*/*'], multiple: true });
      if (doc.canceled || !doc.assets?.length) return;
      picked = doc.assets.map((a) => ({ uri: a.uri, fileName: a.name ?? null, mimeType: a.mimeType ?? null, size: a.size ?? null, kind: ((a.mimeType ?? '').startsWith('image/') ? 'image' : 'document') as 'image' | 'document' }));
    }
    for (const p of picked) {
      const stored = await importEvidenceFile(p);
      if (stored) addEvidenceToPayment(paymentId, stored as EvidenceInput);
    }
    reload();
  };

  const confirmVoid = () => {
    if (!voidTarget || !voidReason.trim()) return;
    voidPayment(voidTarget.id, voidReason.trim());
    setVoidTarget(null);
    setVoidReason('');
    reload();
  };

  const paymentMenu = (p: Payment) => {
    Alert.alert(`${formatMoney(p.amount_minor, p.currency_code)}`, undefined, [
      ...(p.record_status === 'recorded' ? [{ text: 'Edit', onPress: () => setEditPayment(p) }] : []),
      { text: 'Add evidence', onPress: () => void addEvidenceTo(p.id) },
      { text: 'Void payment', style: 'destructive', onPress: () => setVoidTarget(p) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const primaryLabel = done ? 'DONE · REOPEN' : cancelled ? 'REOPEN' : 'MARK AS DONE';
  const primaryBg = done ? colors.success : cancelled ? colors.surfaceMuted : colors.accent;
  const primaryFg = done ? '#FFFFFF' : cancelled ? colors.textPrimary : colors.onAccent;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* hero */}
        <View style={[styles.hero, { backgroundColor: color.hex }]}>
          <DecorativeArt seed={item.id} colorKey={project.color_key} variant="hero" />
          <SafeAreaView edges={['top']}>
            <View style={styles.heroTopRow}>
              <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.heroBtn}>
                <AppText type="heading" color={onColor}>‹</AppText>
              </Pressable>
              <Pressable onPress={itemMenu} accessibilityRole="button" accessibilityLabel="Item options" style={styles.heroBtn}>
                <AppText type="heading" color={onColor}>⋯</AppText>
              </Pressable>
            </View>
          </SafeAreaView>
          <View style={styles.heroCenter}>
            <AvatarBadge avatarKey={item.avatar_key} projectColor={color.hex} size="detail" completed={done} onPress={readOnly ? undefined : pickAvatar} />
          </View>
          <View style={styles.heroChip}>
            <AppText type="caption" color={onColor}>{project.name}</AppText>
          </View>
        </View>

        {/* content */}
        <View style={styles.content}>
          <AppText type="display">{item.title}</AppText>
          <View style={styles.statusRow}>
            {done ? (
              <View style={[styles.statusChip, { backgroundColor: softTint(colors.success) }]}>
                <AppText type="caption" color={colors.success}>Done</AppText>
              </View>
            ) : cancelled ? (
              <View style={[styles.statusChip, { backgroundColor: colors.surfaceMuted }]}>
                <AppText type="caption" color="textSecondary">Cancelled</AppText>
              </View>
            ) : (
              <View style={[styles.statusChip, { backgroundColor: softTint(colors.accent) }]}>
                <AppText type="caption" color={colors.accent}>Open</AppText>
              </View>
            )}
          </View>

          {/* info rows */}
          <View style={styles.infoCard}>
            <InfoRow
              icon="📅"
              iconBg={softTint(color.hex)}
              primary={item.due_date ? formatDueDateLong(item.due_date) : 'No due date'}
              secondary={[item.due_time ?? (item.due_date ? 'All day' : null), overdue ? 'Overdue' : null].filter(Boolean).join(' · ')}
              secondaryColor={overdue ? 'danger' : 'textSecondary'}
            />
            {amounts?.expectedMinor != null ? (
              <InfoRow
                icon="👛"
                iconBg={softTint(color.hex)}
                primary={formatMoney(amounts.expectedMinor, item.currency_code)}
                secondary={`Paid ${formatMoney(amounts.paidMinor, item.currency_code)} · Outstanding ${formatMoney(amounts.outstandingMinor ?? 0, item.currency_code)}`}
                trailing={PAYMENT_STATUS[amounts.paymentStatus]}
                overpaid={amounts.overpaidMinor > 0 ? `Overpaid ${formatMoney(amounts.overpaidMinor, item.currency_code)}` : null}
              />
            ) : null}
            {item.due_date ? (
              <InfoRow
                icon="🔔"
                iconBg={softTint(color.hex)}
                primary={reminderSummary(reminders, item.due_date, item.due_time) || 'Reminder off'}
                secondary={reminders.some((r) => r.enabled) ? 'Tap bookmark to turn off' : 'Tap bookmark to turn on'}
              />
            ) : null}
          </View>

          {item.description ? (
            <View style={styles.notesCard}>
              <AppText type="body" color="textSecondary" numberOfLines={notesOpen ? undefined : 4}>
                {item.description}
              </AppText>
              {item.description.length > 140 ? (
                <Pressable onPress={() => setNotesOpen((v) => !v)} accessibilityRole="button">
                  <AppText type="label" color={colors.accent}>{notesOpen ? 'Show less' : 'Read more'}</AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* payments */}
          {amounts && (amounts.expectedMinor != null || payments.length > 0) ? (
            <View style={styles.paymentsSection}>
              <View style={styles.sectionHeader}>
                <AppText type="heading">Payments</AppText>
                {!readOnly && !done ? (
                  <Pressable onPress={openPayment} accessibilityRole="button" accessibilityLabel="Add payment">
                    <AppText type="label" color={colors.accent}>+ Add payment</AppText>
                  </Pressable>
                ) : null}
              </View>
              {payments.length === 0 ? (
                <AppText type="body" color="textSecondary">No payments recorded yet</AppText>
              ) : (
                payments.map((p) => (
                  <PaymentCard
                    key={p.id}
                    payment={p}
                    evidence={evidence[p.id] ?? []}
                    duplicate={Boolean(p.raw_confirmation_text && findDuplicateRawText(p.raw_confirmation_text, p.id))}
                    onMenu={() => paymentMenu(p)}
                    onOpenEvidence={(i) => setViewer({ payment: p, index: i })}
                  />
                ))
              )}
            </View>
          ) : null}

          {/* history */}
          {activity.length > 0 ? (
            <View style={styles.historySection}>
              <Pressable onPress={() => setHistoryOpen((v) => !v)} accessibilityRole="button" style={styles.sectionHeader}>
                <AppText type="heading">History</AppText>
                <AppText type="label" color="textSecondary">{historyOpen ? 'Hide' : 'Show'}</AppText>
              </Pressable>
              {historyOpen ? (
                activity.map((a) => (
                  <View key={a.id} style={styles.activityRow}>
                    <AppText type="body" style={{ flex: 1 }}>{a.summary}</AppText>
                    <AppText type="caption" color="textTertiary">{fmtPaidAt(a.created_at)}</AppText>
                  </View>
                ))
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* bottom action bar */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <Pressable
          onPress={toggleReminder}
          disabled={!item.due_date || Boolean(readOnly)}
          accessibilityRole="button"
          accessibilityLabel="Toggle reminder"
          style={[styles.reminderBtn, reminders.some((r) => r.enabled) && { backgroundColor: softTint(color.hex) }]}
        >
          <AppText type="heading" color={reminders.some((r) => r.enabled) ? color.hex : 'textSecondary'}>🔔</AppText>
        </Pressable>
        <Pressable
          onPress={onPrimary}
          disabled={Boolean(readOnly)}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          style={[styles.primaryBtn, { backgroundColor: primaryBg }, readOnly && { opacity: 0.5 }]}
        >
          <AppText type="label" color={primaryFg}>{primaryLabel}</AppText>
        </Pressable>
      </SafeAreaView>

      {/* avatar picker */}
      <Modal visible={avatarPickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAvatarPickerOpen(false)}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <AppText type="heading">Choose a buddy</AppText>
            <Pressable onPress={() => setAvatarPickerOpen(false)} accessibilityRole="button">
              <AppText type="heading" color="textSecondary">✕</AppText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.avatarGrid}>
            {ALL_AVATARS.map((a) => (
              <Pressable key={a.key} onPress={() => saveAvatar(a.key)} style={styles.avatarTile} accessibilityRole="button" accessibilityLabel={a.label}>
                <AvatarGlyph avatar={a} size={30} />
                <AppText type="caption" color="textSecondary">{a.label}</AppText>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* evidence viewer */}
      <EvidenceViewer
        visible={Boolean(viewer)}
        payment={viewer?.payment ?? null}
        evidence={viewer ? (evidence[viewer.payment.id] ?? []) : []}
        startIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
        onRemoved={reload}
      />

      <EditItemSheet
        visible={editItemOpen}
        item={item}
        onClose={() => setEditItemOpen(false)}
        onSaved={reload}
      />
      <EditPaymentSheet
        visible={Boolean(editPayment)}
        payment={editPayment}
        currency={item.currency_code}
        onClose={() => setEditPayment(null)}
        onSaved={reload}
      />

      {/* void payment */}
      <Modal visible={Boolean(voidTarget)} transparent animationType="slide" onRequestClose={() => setVoidTarget(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <AppText type="heading">Void payment</AppText>
            <AppText type="body" color="textSecondary">The record stays in history but no longer counts toward totals.</AppText>
            <TextInput
              style={styles.sheetInput}
              value={voidReason}
              onChangeText={setVoidReason}
              placeholder="Reason (required)"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Void reason"
            />
            <View style={styles.sheetActions}>
              <Pressable onPress={() => setVoidTarget(null)} style={styles.sheetBtn} accessibilityRole="button">
                <AppText type="label" color="textSecondary">Cancel</AppText>
              </Pressable>
              <Pressable
                onPress={confirmVoid}
                disabled={!voidReason.trim()}
                style={[styles.sheetBtn, styles.sheetBtnDanger, !voidReason.trim() && { opacity: 0.4 }]}
                accessibilityRole="button"
              >
                <AppText type="label" color="#FFFFFF">Void payment</AppText>
              </Pressable>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function InfoRow({
  icon,
  iconBg,
  primary,
  secondary,
  secondaryColor = 'textSecondary',
  trailing,
  overpaid,
}: {
  icon: string;
  iconBg: string;
  primary: string;
  secondary?: string;
  secondaryColor?: 'textSecondary' | 'danger';
  trailing?: { label: string; color: string };
  overpaid?: string | null;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: iconBg }]}>
        <AppText style={{ fontSize: 22 }}>{icon}</AppText>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText type="heading">{primary}</AppText>
        {secondary ? <AppText type="caption" color={secondaryColor}>{secondary}</AppText> : null}
        {overpaid ? <AppText type="caption" color={colors.accent}>{overpaid}</AppText> : null}
      </View>
      {trailing?.label ? (
        <View style={[styles.statusChip, { backgroundColor: softTint(trailing.color) }]}>
          <AppText type="caption" color={trailing.color}>{trailing.label}</AppText>
        </View>
      ) : null}
    </View>
  );
}

function PaymentCard({
  payment,
  evidence,
  duplicate,
  onMenu,
  onOpenEvidence,
}: {
  payment: Payment;
  evidence: PaymentEvidence[];
  duplicate: boolean;
  onMenu: () => void;
  onOpenEvidence: (index: number) => void;
}) {
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgExpanded, setMsgExpanded] = useState(false);
  const voided = payment.record_status === 'voided';
  const [thumbs, setThumbs] = useState<{ ev: PaymentEvidence; uri: string | null; missing: boolean }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows: { ev: PaymentEvidence; uri: string | null; missing: boolean }[] = [];
      for (const ev of evidence) {
        if (!ev.relative_path) {
          rows.push({ ev, uri: null, missing: true });
          continue;
        }
        const exists = await evidenceFileExists(ev.relative_path);
        const uri = exists ? await resolveEvidenceUri(ev.relative_path) : null;
        rows.push({ ev, uri, missing: !uri });
      }
      if (!cancelled) setThumbs(rows);
    })();
    return () => { cancelled = true; };
  }, [evidence]);

  const copyMessage = () => {
    if (payment.raw_confirmation_text) void Clipboard.setStringAsync(payment.raw_confirmation_text);
  };

  return (
    <View style={[styles.paymentCard, voided && { opacity: 0.6 }]}>
      <View style={styles.paymentTop}>
        <AppText type="heading" style={voided ? { textDecorationLine: 'line-through' } : undefined}>
          {formatMoney(payment.amount_minor, payment.currency_code)}
        </AppText>
        <View style={styles.paymentTopRight}>
          <View style={[styles.methodChip, { backgroundColor: colors.surface }]}>
            <AppText type="caption" color="textSecondary">{METHOD_LABEL[payment.method] ?? payment.method}</AppText>
          </View>
          {voided ? (
            <View style={[styles.methodChip, { backgroundColor: softTint(colors.danger) }]}>
              <AppText type="caption" color={colors.danger}>Voided{payment.void_reason ? ` · ${payment.void_reason}` : ''}</AppText>
            </View>
          ) : null}
          {duplicate && !voided ? (
            <View style={[styles.methodChip, { backgroundColor: softTint(colors.warning) }]}>
              <AppText type="caption" color={colors.warning}>Same message</AppText>
            </View>
          ) : null}
        </View>
      </View>
      <AppText type="caption" color="textSecondary">{fmtPaidAt(payment.paid_at)}</AppText>
      {payment.notes ? <AppText type="body" color="textSecondary">{payment.notes}</AppText> : null}

      {payment.raw_confirmation_text ? (
        <View style={styles.msgWrap}>
          <Pressable onPress={() => setMsgOpen((v) => !v)} accessibilityRole="button">
            <AppText type="label" color="textSecondary">M-Pesa message {msgOpen ? '▾' : '▸'}</AppText>
          </Pressable>
          {msgOpen ? (
            <View style={styles.msgBox}>
              <AppText type="body" numberOfLines={msgExpanded ? undefined : 2}>
                {payment.raw_confirmation_text}
              </AppText>
              <View style={styles.msgActions}>
                <Pressable onPress={() => setMsgExpanded((v) => !v)} accessibilityRole="button">
                  <AppText type="caption" color={colors.accent}>{msgExpanded ? 'Less' : 'More'}</AppText>
                </Pressable>
                <Pressable onPress={copyMessage} accessibilityRole="button" accessibilityLabel="Copy message">
                  <AppText type="caption" color={colors.accent}>Copy</AppText>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {thumbs.length > 0 ? (
        <View style={styles.thumbRow}>
          {thumbs.map(({ ev, uri, missing }, i) => (
            <Pressable
              key={ev.id}
              onPress={() => onOpenEvidence(i)}
              accessibilityRole="button"
              accessibilityLabel={`Evidence ${ev.evidence_type}${missing ? ', file missing' : ''}`}
              style={[styles.thumb, { backgroundColor: colors.surface }]}
            >
              {uri && ev.evidence_type === 'image' ? (
                <Image source={{ uri }} style={styles.thumbImg} />
              ) : (
                <View style={styles.thumbFallback}>
                  <AppText type="caption" color={missing ? colors.danger : 'textSecondary'}>
                    {missing ? 'Missing' : ev.evidence_type === 'pdf' ? 'PDF' : 'File'}
                  </AppText>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}

      {!voided ? (
        <Pressable onPress={onMenu} accessibilityRole="button" accessibilityLabel="Payment options" style={styles.payMenu}>
          <AppText type="label" color="textSecondary">⋯</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  backBtn: { padding: spacing.md },
  scroll: { paddingBottom: 120 },
  hero: { height: 240, borderBottomLeftRadius: radii.xl, borderBottomRightRadius: radii.xl, overflow: 'hidden' },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  heroBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  heroCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroChip: {
    position: 'absolute',
    left: spacing.xl,
    bottom: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.lg },
  statusRow: { marginTop: -spacing.sm },
  statusChip: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  infoCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoIcon: { width: 56, height: 56, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  notesCard: { gap: spacing.sm },
  paymentsSection: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historySection: { gap: spacing.sm },
  activityRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  paymentCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  paymentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  paymentTopRight: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'flex-end' },
  methodChip: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3 },
  msgWrap: { gap: spacing.xs },
  msgBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  msgActions: { flexDirection: 'row', gap: spacing.lg },
  thumbRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  thumb: { width: 56, height: 56, borderRadius: radii.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  payMenu: { position: 'absolute', top: spacing.md, right: spacing.md, padding: spacing.xs },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  reminderBtn: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    flex: 1,
    minHeight: components.button.primary.height,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.floating,
  },
  modalRoot: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  avatarTile: {
    width: components.avatarTile.size,
    minHeight: components.avatarTile.size,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: 4,
  },

  sheetBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetInput: {
    minHeight: components.input.height,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
  },
  sheetActions: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' },
  sheetBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.pill },
  sheetBtnDanger: { backgroundColor: colors.danger },
});
