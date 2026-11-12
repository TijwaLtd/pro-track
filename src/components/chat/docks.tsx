import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View
} from 'react-native';

import { avatarGroups } from '../../domain/avatars';
import { addDaysToDate, nowUtcIso, todayLocalDate, type DueDate } from '../../domain/dates';
import { formatMoneyAmount, parseMoneyToMinor } from '../../domain/money';
import type { PickedFile } from '../../features/evidence/files';
import { onColorFor } from '../../theme/projectColor';
import { colors, components, projectPalette, radii, spacing, typography } from '../../theme/tokens';
import { AvatarGlyph } from '../AvatarGlyph';
import { AppText } from '../ui/Text';
import type { Answers, EvalContext } from './eval';
import { evalVisible } from './eval';
import type { FlowStep } from './flows';

export interface DockProps {
  step: FlowStep;
  answers: Answers;
  ctx: EvalContext;
  onAnswer: (value: unknown, display?: string) => void;
  onSkip: () => void;
}

function interp(template: string, answers: Answers, ctx: EvalContext): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = key in answers ? answers[key] : ctx[key];
    if (v == null) return '';
    return String(v);
  });
}

/* ---------------------------------- chips --------------------------------- */

export function ChipsDock({ step, answers, ctx, onAnswer, onSkip }: DockProps) {
  const chips = (step.chips ?? []).filter((c) => {
    // chipsVisibleIf applies to the whole chips row in newPayment.amount
    return true;
  });
  const showChips = evalVisible(step.chipsVisibleIf, { ...answers, ...ctx }, ctx) || !step.chipsVisibleIf;
  return (
    <View style={styles.dock}>
      {showChips && chips.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {chips.map((chip) => (
            <Pressable
              key={chip}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAnswer(chip, interp(chip, answers, ctx));
              }}
              style={styles.chip}
              accessibilityRole="button"
              accessibilityLabel={interp(chip, answers, ctx)}
            >
              <AppText type="label" color="textPrimary">
                {interp(chip, answers, ctx)}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {step.optional ? <SkipChip onPress={onSkip} /> : null}
    </View>
  );
}

export function SkipChip({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, styles.skipChip]} accessibilityRole="button" accessibilityLabel="Skip">
      <AppText type="label" color="textSecondary">
        Skip
      </AppText>
    </Pressable>
  );
}

/* ---------------------------------- text ---------------------------------- */

export function TextDock({ step, onAnswer }: DockProps) {
  const [value, setValue] = useState('');
  const submit = () => {
    const v = value.trim();
    if (!v && step.required !== false && !step.optional) return;
    onAnswer(v || null, v);
  };
  return (
    <View style={styles.dock}>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={value}
            onChangeText={setValue}
            placeholder={step.optional ? 'optional' : 'type your answer'}
            placeholderTextColor={colors.textTertiary}
            maxLength={step.maxLength}
            autoFocus
            returnKeyType="send"
            onSubmitEditing={submit}
            accessibilityLabel="Answer"
          />
          <Pressable onPress={submit} style={styles.sendButton} accessibilityRole="button" accessibilityLabel="Send">
            <AppText type="label" color={colors.onAccent}>Send</AppText>
          </Pressable>
        </View>
        {step.optional ? <SkipChip onPress={() => onAnswer(null)} /> : null}
    </View>
  );
}

export function MultilineDock({ step, onAnswer }: DockProps) {
  const [value, setValue] = useState('');
  const submit = () => onAnswer(value.trim() || null, value.trim().slice(0, 60));
  return (
    <View style={styles.dock}>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={value}
        onChangeText={setValue}
        placeholder={step.optional ? 'optional' : 'type your answer'}
        placeholderTextColor={colors.textTertiary}
        multiline
        autoFocus
        accessibilityLabel="Answer"
      />
      <View style={styles.inputRow}>
        <Pressable onPress={submit} style={[styles.sendButton, { flex: 1 }]} accessibilityRole="button" accessibilityLabel="Send">
          <AppText type="label" color={colors.onAccent}>Send</AppText>
        </Pressable>
      </View>
      {step.optional ? <SkipChip onPress={() => onAnswer(null)} /> : null}
    </View>
  );
}

/* --------------------------------- colour --------------------------------- */

export function ColorSwatchDock({ step, onAnswer }: DockProps) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <View style={styles.dock}>
      <View style={styles.swatchGrid}>
        {projectPalette.map((p) => {
          const isSel = selected === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => {
                setSelected(p.key);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAnswer(p.key, p.label);
              }}
              style={[
                styles.swatch,
                { backgroundColor: p.hex },
                isSel && styles.swatchSelected,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${p.label} colour`}
            >
              {isSel ? <AppText color={onColorFor(p)} style={styles.swatchCheck}>✓</AppText> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ---------------------------------- avatar --------------------------------- */

export function AvatarDock({ step, answers, ctx, onAnswer }: DockProps) {
  const [tab, setTab] = useState(0);
  const group = avatarGroups[tab];
  const used = useMemo(() => {
    const s = new Set<string>();
    const raw = ctx.usedAvatarKeys;
    if (Array.isArray(raw)) raw.forEach((k) => s.add(String(k)));
    return s;
  }, [ctx.usedAvatarKeys]);

  const shuffle = () => {
    const pool = group.items.filter((a) => !used.has(a.key));
    const pick = (pool.length ? pool : group.items)[Math.floor(Math.random() * (pool.length ? pool.length : group.items.length))];
    onAnswer(pick.key, pick.label);
  };

  return (
    <View style={styles.dock}>
      <View style={styles.tabRow}>
        {avatarGroups.map((g, i) => (
          <Pressable key={g.id} onPress={() => setTab(i)} style={[styles.chip, tab === i && styles.chipSelected]} accessibilityRole="button">
            <AppText type="label" color={tab === i ? '#FFFFFF' : 'textPrimary'}>{g.label}</AppText>
          </Pressable>
        ))}
        <Pressable onPress={shuffle} style={styles.chip} accessibilityRole="button" accessibilityLabel="Shuffle">
          <AppText type="label" color="textPrimary">Shuffle</AppText>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.avatarGrid} style={{ maxHeight: 260 }}>
        {group.items.map((a) => (
          <Pressable
            key={a.key}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAnswer(a.key, a.label);
            }}
            style={styles.avatarTile}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <AvatarGlyph avatar={a} size={30} />
            {used.has(a.key) ? <AppText type="caption" color="textTertiary">used</AppText> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/* ----------------------------------- date ---------------------------------- */

function endOfThisMonth(): DueDate {
  const d = new Date();
  return format(new Date(d.getFullYear(), d.getMonth() + 1, 0), 'yyyy-MM-dd');
}

function chipToDate(chip: string, mode: 'date' | 'datetime'): string | null {
  const today = todayLocalDate();
  switch (chip) {
    case 'No date': return null;
    case 'Today': return mode === 'datetime' ? new Date().toISOString() : today;
    case 'Tomorrow': return addDaysToDate(today, 1);
    case 'This week': return addDaysToDate(today, 7);
    case 'End of this month': return endOfThisMonth();
    case 'Yesterday': {
      if (mode === 'datetime') return new Date(Date.now() - 24 * 3600_000).toISOString();
      return addDaysToDate(today, -1);
    }
    case 'Just now': return nowUtcIso();
    case 'Earlier today': {
      const d = new Date();
      d.setHours(8, 0, 0, 0);
      return mode === 'datetime' ? d.toISOString() : today;
    }
    default: return undefined as never;
  }
}

export function DateDock({ step, answers, ctx, onAnswer, onSkip }: DockProps) {
  const mode: 'date' | 'datetime' = step.id === 'when' || step.field === 'paid_at' ? 'datetime' : 'date';
  const [showPicker, setShowPicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(new Date());

  const onPick = (event: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(false);
    if (event.type !== 'set' || !selected) return;
    if (mode === 'datetime') {
      onAnswer(selected.toISOString(), format(selected, 'PPpp'));
    } else {
      onAnswer(format(selected, 'yyyy-MM-dd'), format(selected, 'PPP'));
    }
  };

  return (
    <View style={styles.dock}>
      <View style={styles.chipWrap}>
        {(step.chips ?? []).map((chip) => (
          <Pressable
            key={chip}
            onPress={() => {
              if (chip === 'Pick a date' || chip === 'Pick date & time' || chip === 'Pick time') {
                setPickerValue(new Date());
                setShowPicker(true);
                return;
              }
              const v = chipToDate(chip, mode);
              if (v === undefined) return;
              const display = v == null ? 'No date' : mode === 'datetime' ? format(new Date(v), 'PPp') : format(new Date(`${v}T12:00:00`), 'PPP');
              onAnswer(v, display);
            }}
            style={styles.chip}
            accessibilityRole="button"
            accessibilityLabel={chip}
          >
            <AppText type="label" color="textPrimary">{chip}</AppText>
          </Pressable>
        ))}
        {step.optional ? <SkipChip onPress={onSkip} /> : null}
      </View>
      {showPicker ? (
        <DateTimePicker
          value={pickerValue}
          mode={mode === 'datetime' ? 'datetime' : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPick}
        />
      ) : null}
    </View>
  );
}

export function TimeDock({ step, onAnswer, onSkip }: DockProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(new Date());

  const onPick = (event: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(false);
    if (event.type !== 'set' || !selected) return;
    const hhmm = format(selected, 'HH:mm');
    onAnswer(hhmm, hhmm);
  };

  return (
    <View style={styles.dock}>
      <View style={styles.chipWrap}>
        {(step.chips ?? []).map((chip) => (
          <Pressable
            key={chip}
            onPress={() => {
              if (chip === 'Pick a time' || chip === 'Pick time') {
                setPickerValue(new Date());
                setShowPicker(true);
                return;
              }
              if (chip === 'All day') return onAnswer(null, 'All day');
              if (chip === 'Morning') return onAnswer('08:00', 'Morning');
              if (chip === 'Afternoon') return onAnswer('14:00', 'Afternoon');
            }}
            style={styles.chip}
            accessibilityRole="button"
            accessibilityLabel={chip}
          >
            <AppText type="label" color="textPrimary">{chip}</AppText>
          </Pressable>
        ))}
        {step.optional ? <SkipChip onPress={onSkip} /> : null}
      </View>
      {showPicker ? <DateTimePicker value={pickerValue} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onPick} /> : null}
    </View>
  );
}

/* ----------------------------------- money --------------------------------- */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export function MoneyDock({ step, answers, ctx, onAnswer }: DockProps) {
  // step.currency may be a literal ('KES') or a context path ('project.currency_code', 'item.currency_code')
  const currencyRaw = typeof step.currency === 'string' ? step.currency : String(ctx.currency ?? 'KES');
  const currency =
    currencyRaw in ctx || currencyRaw in answers
      ? String((currencyRaw in answers ? answers : ctx)[currencyRaw] ?? 'KES')
      : currencyRaw.includes('.')
        ? String(currencyRaw.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], ctx as Record<string, unknown>) ?? 'KES')
        : currencyRaw;
  const [raw, setRaw] = useState('');
  const minor = parseMoneyToMinor(raw);

  const chipValue = (chip: string): number | null => {
    // chips like "Balance {outstanding}" — resolve numeric from context
    const resolved = interp(chip, answers, ctx);
    const num = ctx.outstandingMinor;
    if (/balance/i.test(chip) && typeof num === 'number') return num;
    const parsed = parseMoneyToMinor(resolved);
    return parsed;
  };

  const press = (k: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRaw((prev) => {
      if (k === '⌫') return prev.slice(0, -1);
      if (k === '.' && prev.includes('.')) return prev;
      if (prev.replace(/[^0-9]/g, '').length >= 12) return prev;
      return prev + k;
    });
  };

  const display = minor != null && raw !== '' ? formatMoneyAmount(minor) : raw || '0';

  return (
    <View style={styles.dock}>
      {(step.chips ?? []).length > 0 ? (
        <View style={styles.chipWrap}>
          {(step.chips ?? []).map((chip) => (
            <Pressable
              key={chip}
              onPress={() => {
                const v = chipValue(chip);
                if (v != null) {
                  setRaw((v / 100).toFixed(2).replace(/\.00$/, ''));
                }
              }}
              style={styles.chip}
              accessibilityRole="button"
            >
              <AppText type="label" color="textPrimary">{interp(chip, answers, ctx)}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.moneyDisplay}>
        <AppText type="caption" color="textSecondary">{currency}</AppText>
        <AppText type="display" style={styles.moneyAmount}>{display}</AppText>
      </View>
      <View style={styles.keypad}>
        {KEYS.map((k) => (
          <Pressable key={k} onPress={() => press(k)} style={styles.key} accessibilityRole="button" accessibilityLabel={k === '⌫' ? 'Backspace' : k}>
            <AppText type="heading">{k}</AppText>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={() => minor != null && minor > 0 && onAnswer(minor, `${currency} ${formatMoneyAmount(minor)}`)}
        disabled={minor == null || minor <= 0}
        style={[styles.sendButton, { alignSelf: 'stretch', marginTop: spacing.sm }, (minor == null || minor <= 0) && { opacity: 0.4 }]}
        accessibilityRole="button"
        accessibilityLabel="Confirm amount"
      >
        <AppText type="label" color={colors.onAccent}>Confirm</AppText>
      </Pressable>
    </View>
  );
}

/* ----------------------------------- paste --------------------------------- */

export function PasteDock({ step, onAnswer, onSkip }: DockProps) {
  const [value, setValue] = useState('');
  return (
    <View style={styles.dock}>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={value}
        onChangeText={setValue}
        placeholder="paste the message here"
        placeholderTextColor={colors.textTertiary}
        multiline
        accessibilityLabel="Pasted message"
      />
      <View style={styles.inputRow}>
        <Pressable
          onPress={async () => {
            const text = await Clipboard.getStringAsync();
            if (text) setValue(text);
          }}
          style={[styles.chip, { marginRight: spacing.sm }]}
          accessibilityRole="button"
          accessibilityLabel="Paste from clipboard"
        >
          <AppText type="label" color="textPrimary">Paste from clipboard</AppText>
        </Pressable>
        <Pressable
          onPress={() => onAnswer(value, value.slice(0, 60))}
          disabled={!value.trim()}
          style={[styles.sendButton, { flex: 1 }, !value.trim() && { opacity: 0.4 }]}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          <AppText type="label" color={colors.onAccent}>Send</AppText>
        </Pressable>
      </View>
      {step.optional ? <SkipChip onPress={onSkip} /> : null}
    </View>
  );
}

/* ---------------------------------- attach --------------------------------- */

/**
 * Evidence picker: photos via the image library, anything else via the
 * document picker. Returns PickedFile[] — files are copied into app-private
 * evidence storage on confirm (flowActions), never left in cache.
 */
export function AttachDock({ step, onAnswer, onSkip }: DockProps) {
  const [files, setFiles] = useState<PickedFile[]>([]);

  const addImages = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (res.canceled) return;
    const picked: PickedFile[] = res.assets.map((a) => ({
      uri: a.uri,
      fileName: a.fileName ?? a.uri.split('/').pop() ?? null,
      mimeType: a.mimeType ?? 'image/jpeg',
      size: a.fileSize ?? null,
      kind: 'image' as const,
    }));
    setFiles((prev) => [...prev, ...picked]);
  };

  const addDocuments = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: ['image/*', 'application/pdf', '*/*'],
      multiple: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const picked: PickedFile[] = res.assets.map((a) => ({
      uri: a.uri,
      fileName: a.name ?? a.uri.split('/').pop() ?? null,
      mimeType: a.mimeType ?? null,
      size: a.size ?? null,
      kind: (a.mimeType ?? '').startsWith('image/') ? ('image' as const) : ('document' as const),
    }));
    setFiles((prev) => [...prev, ...picked]);
  };

  const removeAt = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <View style={styles.dock}>
      <View style={styles.chipWrap}>
        <Pressable onPress={() => void addImages()} style={styles.chip} accessibilityRole="button" accessibilityLabel="Add photos">
          <AppText type="label" color="textPrimary">Photos</AppText>
        </Pressable>
        <Pressable onPress={() => void addDocuments()} style={styles.chip} accessibilityRole="button" accessibilityLabel="Add files">
          <AppText type="label" color="textPrimary">Files / PDF</AppText>
        </Pressable>
        {step.optional ? <SkipChip onPress={onSkip} /> : null}
      </View>
      {files.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {files.map((f, i) => (
            <View key={`${f.uri}-${i}`} style={styles.attachTile}>
              <AppText type="caption" color="textSecondary" numberOfLines={1} style={styles.attachName}>
                {f.fileName ?? 'file'}
              </AppText>
              <Pressable onPress={() => removeAt(i)} accessibilityRole="button" accessibilityLabel={`Remove ${f.fileName ?? 'file'}`}>
                <AppText type="label" color={colors.danger}>✕</AppText>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <Pressable
        onPress={() => onAnswer(files.length ? files : null, files.length ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'No evidence')}
        disabled={files.length === 0}
        style={[styles.sendButton, { alignSelf: 'stretch' }, files.length === 0 && { opacity: 0.4 }]}
        accessibilityRole="button"
        accessibilityLabel="Confirm evidence"
      >
        <AppText type="label" color={colors.onAccent}>{files.length ? `Add ${files.length} file${files.length > 1 ? 's' : ''}` : 'Skip'}</AppText>
      </Pressable>
    </View>
  );
}

/* ---------------------------------- styles --------------------------------- */

const styles = StyleSheet.create({
  dock: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: components.quickChip.height,
    paddingHorizontal: components.quickChip.paddingH,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  skipChip: { borderStyle: 'dashed' },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    minHeight: components.input.height,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.scale.body.size,
    color: colors.textPrimary,
  },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  sendButton: {
    minHeight: components.button.primary.height,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: components.swatchPicker.gap },
  swatch: {
    width: components.swatchPicker.swatchSize,
    height: components.swatchPicker.swatchSize,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: components.swatchPicker.selected.ring,
    borderColor: colors.textPrimary,
  },
  swatchCheck: { fontWeight: '700' },
  tabRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  avatarTile: {
    width: components.avatarTile.size,
    minHeight: components.avatarTile.size,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  moneyDisplay: { alignItems: 'center', paddingVertical: spacing.sm },
  attachTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: 220,
  },
  attachName: { flexShrink: 1 },
  moneyAmount: { fontVariant: ['tabular-nums'] },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  key: {
    width: '30%',
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
