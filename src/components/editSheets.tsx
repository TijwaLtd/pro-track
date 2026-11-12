import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { itemAmounts } from '../db/derived';
import { updateItem } from '../db/repositories/items';
import { listPaymentsForItem, updatePayment } from '../db/repositories/payments';
import { updateProject } from '../db/repositories/projects';
import type { Payment, PaymentMethod, Project, ProjectItem, ProjectStatus } from '../db/types';
import { addDaysToDate, todayLocalDate } from '../domain/dates';
import { formatMoney, formatMoneyAmount, parseMoneyToMinor } from '../domain/money';
import { colors, components, projectPalette, radii, spacing } from '../theme/tokens';
import { AppText } from './ui/Text';

/* ------------------------------ shared bits ------------------------------- */

function SheetShell({
  visible,
  title,
  onClose,
  onSave,
  saveDisabled,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <View style={styles.handle} />
        <AppText type="heading" style={styles.title}>{title}</AppText>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        <View style={styles.actions}>
          <Pressable onPress={onClose} style={styles.cancelBtn} accessibilityRole="button">
            <AppText type="label" color="textSecondary">Cancel</AppText>
          </Pressable>
          <Pressable
            onPress={onSave}
            disabled={saveDisabled}
            style={[styles.saveBtn, saveDisabled && { opacity: 0.4 }]}
            accessibilityRole="button"
          >
            <AppText type="label" color={colors.onAccent}>Save</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <AppText type="caption" color="textSecondary">{label}</AppText>
      {children}
    </View>
  );
}

function ChipRow({
  options,
  value,
  onChange,
  format,
  extra,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
  format?: (v: string) => string;
  extra?: React.ReactNode;
}) {
  return (
    <View style={styles.chipWrap}>
      {extra}
      {options.map((o) => {
        const sel = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(sel ? null : o.value)}
            style={[styles.chip, sel && styles.chipSel]}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
          >
            <AppText type="label" color={sel ? '#FFFFFF' : 'textPrimary'}>
              {format ? format(o.value) : o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Chip that opens the native date picker for an arbitrary YYYY-MM-DD date. */
function CustomDatePicker({ onSelect, label = 'Pick a date…' }: { onSelect: (ymd: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => new Date());

  const onChange = (event: DateTimePickerEvent, selected?: Date) => {
    setOpen(false);
    if (event.type === 'set' && selected) onSelect(format(selected, 'yyyy-MM-dd'));
  };

  return (
    <>
      <Pressable
        onPress={() => {
          setValue(new Date());
          setOpen(true);
        }}
        style={styles.chip}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <AppText type="label" color="textPrimary">{label}</AppText>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChange}
        />
      ) : null}
    </>
  );
}

/* ------------------------------ edit project ------------------------------ */

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
];

export function EditProjectSheet({
  visible,
  project,
  onClose,
  onSaved,
}: {
  visible: boolean;
  project: Project | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(() => project?.name ?? '');
  const [colorKey, setColorKey] = useState(() => project?.color_key ?? 'coral');
  const [targetEnd, setTargetEnd] = useState<string | null>(() => project?.target_end_date ?? null);
  const [status, setStatus] = useState<ProjectStatus>(() => (project?.status === 'archived' ? 'active' : project?.status) ?? 'active');
  const [description, setDescription] = useState(() => project?.description ?? '');

  if (!visible || !project) return null;

  const save = () => {
    if (!project || !name.trim()) return;
    updateProject(project.id, {
      name: name.trim(),
      color_key: colorKey,
      target_end_date: targetEnd === 'none' ? null : targetEnd,
      status,
      description: description.trim() || null,
    });
    onSaved();
    onClose();
  };

  return (
    <SheetShell visible={visible} title="Edit project" onClose={onClose} onSave={save} saveDisabled={!name.trim()}>
      <Field label="Name">
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Project name" placeholderTextColor={colors.textTertiary} />
      </Field>
      <Field label="Colour">
        <View style={styles.swatchRow}>
          {projectPalette.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => setColorKey(p.key)}
              style={[styles.swatch, { backgroundColor: p.hex }, colorKey === p.key && styles.swatchSel]}
              accessibilityRole="button"
              accessibilityLabel={`${p.label} colour`}
              accessibilityState={{ selected: colorKey === p.key }}
            >
              {colorKey === p.key ? <AppText color={p.onColor}>✓</AppText> : null}
            </Pressable>
          ))}
        </View>
      </Field>
      <Field label="Target end">
        <ChipRow
          value={targetEnd}
          onChange={setTargetEnd}
          options={[
            { value: todayLocalDate(), label: 'Today' },
            { value: addDaysToDate(todayLocalDate(), 7), label: 'This week' },
            { value: addDaysToDate(todayLocalDate(), 30), label: 'In a month' },
            { value: 'none', label: 'No date' },
          ]}
          format={(v) => (v === 'none' ? 'No date' : v)}
          extra={<CustomDatePicker onSelect={setTargetEnd} />}
        />
        {targetEnd && targetEnd !== 'none' ? (
          <AppText type="caption" color="textSecondary">{targetEnd}</AppText>
        ) : null}
      </Field>
      <Field label="Status">
        <ChipRow
          value={status}
          onChange={(v) => v && setStatus(v as ProjectStatus)}
          options={PROJECT_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        />
      </Field>
      <Field label="Description">
        <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Optional" placeholderTextColor={colors.textTertiary} multiline />
      </Field>
    </SheetShell>
  );
}

/* ------------------------------- edit item -------------------------------- */

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export function EditItemSheet({
  visible,
  item,
  onClose,
  onSaved,
}: {
  visible: boolean;
  item: ProjectItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(() => item?.title ?? '');
  const [dueDate, setDueDate] = useState<string | null>(() => item?.due_date ?? null);
  const [dueTime, setDueTime] = useState<string | null>(() => item?.due_time ?? null);
  const [amountText, setAmountText] = useState(() => (item?.expected_amount_minor != null ? formatMoneyAmount(item.expected_amount_minor) : ''));
  const [priority, setPriority] = useState<ProjectItem['priority']>(() => item?.priority ?? 'normal');
  const [description, setDescription] = useState(() => item?.description ?? '');

  if (!visible || !item) return null;

  const save = () => {
    if (!item || !title.trim()) return;
    const parsed = amountText.trim() === '' ? null : parseMoneyToMinor(amountText);
    if (amountText.trim() !== '' && parsed == null) {
      Alert.alert('Invalid amount', 'Enter a number like 1200 or 1200.50.');
      return;
    }
    const payments = listPaymentsForItem(item.id);
    const costChanged = parsed !== item.expected_amount_minor;
    const doSave = () => {
      updateItem(item.id, {
        title: title.trim(),
        due_date: dueDate === 'none' ? null : dueDate,
        due_time: dueTime === 'none' ? null : dueTime,
        expected_amount_minor: parsed,
        priority,
        description: description.trim() || null,
      });
      onSaved();
      onClose();
    };
    if (costChanged && payments.length > 0 && parsed != null) {
      const amounts = itemAmounts({ expected_amount_minor: parsed }, payments);
      Alert.alert(
        'Cost changed',
        `New balance: ${formatMoney(amounts.outstandingMinor ?? 0, item.currency_code)} outstanding. Save anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: doSave },
        ],
      );
    } else {
      doSave();
    }
  };

  return (
    <SheetShell visible={visible} title="Edit item" onClose={onClose} onSave={save} saveDisabled={!title.trim()}>
      <Field label="Title">
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="What needs doing?" placeholderTextColor={colors.textTertiary} />
      </Field>
      <Field label="Due date">
        <ChipRow
          value={dueDate}
          onChange={(v) => {
            if (v === 'none') { setDueDate(null); setDueTime(null); return; }
            setDueDate(v);
          }}
          options={[
            { value: todayLocalDate(), label: 'Today' },
            { value: addDaysToDate(todayLocalDate(), 1), label: 'Tomorrow' },
            { value: addDaysToDate(todayLocalDate(), 7), label: 'This week' },
            { value: 'none', label: 'No date' },
          ]}
          extra={<CustomDatePicker onSelect={setDueDate} />}
        />
        {dueDate && dueDate !== 'none' ? (
          <AppText type="caption" color="textSecondary">
            {format(new Date(`${dueDate}T12:00:00`), 'PPP')}
          </AppText>
        ) : null}
      </Field>
      {dueDate ? (
        <Field label="Time">
          <ChipRow
            value={dueTime}
            onChange={(v) => setDueTime(v === 'none' ? null : v)}
            options={[
              { value: 'none', label: 'All day' },
              { value: '08:00', label: 'Morning' },
              { value: '14:00', label: 'Afternoon' },
            ]}
          />
        </Field>
      ) : null}
      <Field label="Expected cost">
        <TextInput
          style={styles.input}
          value={amountText}
          onChangeText={setAmountText}
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
        />
      </Field>
      <Field label="Priority">
        <ChipRow
          value={priority}
          onChange={(v) => v && setPriority(v as ProjectItem['priority'])}
          options={PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
        />
      </Field>
      <Field label="Notes">
        <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Optional" placeholderTextColor={colors.textTertiary} multiline />
      </Field>
    </SheetShell>
  );
}

/* ------------------------------ edit payment ------------------------------ */

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export function EditPaymentSheet({
  visible,
  payment,
  currency,
  onClose,
  onSaved,
}: {
  visible: boolean;
  payment: Payment | null;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amountText, setAmountText] = useState(() => (payment ? formatMoneyAmount(payment.amount_minor) : ''));
  const [method, setMethod] = useState<PaymentMethod>(() => payment?.method ?? 'mpesa');
  const [paidAt, setPaidAt] = useState<string | null>(() => payment?.paid_at ?? null);
  const [notes, setNotes] = useState(() => payment?.notes ?? '');

  if (!visible || !payment || payment.record_status === 'voided') return null;

  const save = () => {
    const parsed = parseMoneyToMinor(amountText);
    if (parsed == null || parsed <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number.');
      return;
    }
    updatePayment(payment.id, {
      amount_minor: parsed,
      method,
      paid_at: paidAt ?? payment.paid_at,
      notes: notes.trim() || null,
    });
    onSaved();
    onClose();
  };

  const paidAtLabel = (v: string) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SheetShell visible={visible} title="Edit payment" onClose={onClose} onSave={save}>
      <Field label={`Amount (${currency})`}>
        <TextInput style={styles.input} value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" />
      </Field>
      <Field label="Method">
        <ChipRow value={method} onChange={(v) => v && setMethod(v as PaymentMethod)} options={METHODS.map((m) => ({ value: m.value, label: m.label }))} />
      </Field>
      <Field label="Paid at">
        <AppText type="body" style={{ marginBottom: spacing.sm }}>{paidAt ? paidAtLabel(paidAt) : '—'}</AppText>
        <ChipRow
          value={null}
          onChange={(v) => {
            if (!v) return;
            if (v === 'now') setPaidAt(new Date().toISOString());
            if (v === 'today') { const d = new Date(); d.setHours(8, 0, 0, 0); setPaidAt(d.toISOString()); }
            if (v === 'yesterday') setPaidAt(new Date(Date.now() - 24 * 3600_000).toISOString());
          }}
          options={[
            { value: 'now', label: 'Just now' },
            { value: 'today', label: 'Earlier today' },
            { value: 'yesterday', label: 'Yesterday' },
          ]}
        />
      </Field>
      {payment.raw_confirmation_text ? (
        <Field label="M-Pesa message (verbatim)">
          <View style={styles.readOnlyBox}>
            <AppText type="body" color="textSecondary">{payment.raw_confirmation_text}</AppText>
          </View>
        </Field>
      ) : null}
      <Field label="Notes">
        <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} placeholder="Optional" placeholderTextColor={colors.textTertiary} multiline />
      </Field>
    </SheetShell>
  );
}

/* -------------------------------- styles ---------------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.sm },
  title: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg },
  field: { gap: spacing.sm },
  input: {
    minHeight: components.input.height,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontSize: 15,
  },
  multiline: { minHeight: 80, paddingTop: spacing.md, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSel: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: components.swatchPicker.swatchSize,
    height: components.swatchPicker.swatchSize,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSel: { borderWidth: 3, borderColor: colors.textPrimary },
  readOnlyBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  saveBtn: {
    flex: 1,
    minHeight: components.button.primary.height,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
