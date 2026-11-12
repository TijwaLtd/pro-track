import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAvatar, pickRandomAvatar } from '../../domain/avatars';
import { formatDueDate } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { useChatFormStore } from '../../store/chatForm';
import { getProjectColor } from '../../theme/projectColor';
import { colors, components, radii, spacing } from '../../theme/tokens';
import { AvatarGlyph } from '../AvatarGlyph';
import { AppText } from '../ui/Text';
import {
    AttachDock,
    AvatarDock,
    ChipsDock,
    ColorSwatchDock,
    DateDock,
    MoneyDock,
    MultilineDock,
    PasteDock,
    TextDock,
    TimeDock,
    type DockProps
} from './docks';
import type { Answers } from './eval';
import { confirmFlow } from './flowActions';
import { getFlow, visibleSteps, type FlowDef, type FlowStep } from './flows';

interface ChatMessage {
  id: number;
  role: 'app' | 'user';
  kind: 'text' | 'summary' | 'typing';
  text: string;
  stepId?: string;
  visual?: { type: 'color' | 'avatar'; value: string };
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  color_key: 'Colour',
  target_end_date: 'Target end',
  title: 'Title',
  avatar_key: 'Buddy',
  due_date: 'Due',
  due_time: 'Time',
  has_cost: 'Cost',
  expected_amount: 'Amount',
  reminder: 'Reminder',
  description: 'Notes',
  amount: 'Amount',
  method: 'Method',
  raw_confirmation_text: 'Message',
  paid_at: 'Paid on',
  notes: 'Note',
};

function stepAppText(flow: FlowDef, step: FlowStep, firstRun: boolean, answers: Answers): string {
  let text = step.app;
  // chat-forms.json firstRun: "intro text becomes '…'"
  if (firstRun && step.id === 'intro' && flow.firstRun) {
    const m = flow.firstRun.match(/'([^']+)'/);
    if (m) text = m[1];
  }
  return text.replace('{name}', String(answers.name ?? 'it'));
}

function formatAnswerValue(field: string | undefined, value: unknown, ctx: Record<string, unknown>): string {
  if (value == null) return '—';
  if (field === 'due_date') return formatDueDate(String(value)) || String(value);
  if (field === 'paid_at') {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }
  if (typeof value === 'number' && /amount|outstanding|balance|paid|cost/i.test(field ?? '')) {
    return formatMoney(value, String(ctx.currency ?? 'KES'));
  }
  if (field === 'avatar_key') return getAvatar(String(value)).label;
  if (field === 'color_key') return String(value);
  return String(value);
}

/** Scripted chat form — no AI, no network. One question at a time. */
export function ChatForm() {
  const { open, flow: flowName, context, firstRun, closeForm } = useChatFormStore();
  const flow = flowName ? getFlow(flowName) : null;

  const [answers, setAnswers] = useState<Answers>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const idRef = useRef(0);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const nextId = () => ++idRef.current;

  const ctx = useMemo(() => ({ ...context }), [context]);
  const steps = useMemo(
    () => (flow ? visibleSteps(flow, answers, ctx) : []),
    [flow, answers, ctx],
  );
  const currentStep: FlowStep | undefined = steps[Math.min(cursor, steps.length - 1)];

  const reset = useCallback(() => {
    setAnswers({});
    setMessages([]);
    setCursor(0);
    setTyping(false);
    setConfirming(false);
    idRef.current = 0;
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(reset, 0);
    return () => clearTimeout(t);
  }, [open, reset]);

  // Push the app question for the current step (with typing dots first).
  useEffect(() => {
    if (!open || !flow || !currentStep) return;
    if (currentStep.type === 'summaryCard') return; // summary handled below
    let cancelled = false;
    let inner: ReturnType<typeof setTimeout> | undefined;
    const step = currentStep;
    const text = stepAppText(flow, step, firstRun, answers);
    const outer = setTimeout(() => {
      if (cancelled) return;
      setTyping(true);
      inner = setTimeout(() => {
        if (cancelled) return;
        setTyping(false);
        const id = nextId();
        setMessages((prev) => [
          ...prev,
          { id, role: 'app', kind: 'text', text, stepId: step.id },
        ]);
        AccessibilityInfo.announceForAccessibility?.(text);
        // auto steps advance on their own
        if (step.type === 'none' || step.auto === true) {
          setTimeout(() => {
            if (!cancelled) setCursor((c) => c + 1);
          }, 700);
        }
      }, components.chatBubble.typing.durationMs);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(outer);
      if (inner !== undefined) clearTimeout(inner);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentStep?.id, cursor]);

  // Prefill defaults silently when a step with a default is reached.
  useEffect(() => {
    if (!currentStep?.field || currentStep.type === 'summaryCard') return;
    const f = currentStep.field;
    if (answers[f] !== undefined) return;
    const step = currentStep;
    const t = setTimeout(() => {
      if (step.default !== undefined) {
        setAnswers((a) => (a[f] === undefined ? { ...a, [f]: step.default } : a));
      } else if (step.type === 'avatar' && f === 'avatar_key') {
        // random avatar not already used in this project (avatars.json defaultRule)
        const used = new Set<string>((ctx.usedAvatarKeys as string[] | undefined) ?? []);
        setAnswers((a) => (a[f] === undefined ? { ...a, [f]: pickRandomAvatar(used).key } : a));
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep?.id]);

  const pushUserMessage = useCallback((step: FlowStep, value: unknown, display?: string) => {
    const text = display ?? formatAnswerValue(step.field, value, ctx);
    const visual =
      step.type === 'avatar'
        ? { type: 'avatar' as const, value: String(value) }
        : step.type === 'colorSwatch'
          ? { type: 'color' as const, value: String(value) }
          : undefined;
    const id = nextId();
    setMessages((prev) => [
      ...prev,
      { id, role: 'user', kind: 'text', text, stepId: step.id, visual },
    ]);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [ctx]);

  const advance = useCallback(() => setCursor((c) => c + 1), []);

  const handleAnswer = useCallback(
    (value: unknown, display?: string) => {
      if (!currentStep) return;
      if (!currentStep.field) {
        // steps without a field (chips acting as navigation) just advance
        pushUserMessage(currentStep!, value, display);
        advance();
        return;
      }
      const field = currentStep.field;
      setAnswers((a) => ({ ...a, [field]: value }));
      pushUserMessage(currentStep, value, display);
      advance();
    },
    [currentStep, pushUserMessage, advance],
  );

  const handleSkip = useCallback(() => {
    if (currentStep?.field) {
      setAnswers((a) => ({ ...a, [currentStep.field!]: null }));
    }
    advance();
  }, [currentStep, advance]);

  // Summary card appears once the summary step is current.
  const isSummary = currentStep?.type === 'summaryCard';
  useEffect(() => {
    if (!isSummary || !currentStep) return;
    const step = currentStep;
    let cancelled = false;
    let inner: ReturnType<typeof setTimeout> | undefined;
    const outer = setTimeout(() => {
      if (cancelled) return;
      setTyping(true);
      inner = setTimeout(() => {
        if (cancelled) return;
        setTyping(false);
        const id1 = nextId();
        const id2 = nextId();
        setMessages((prev) => [
          ...prev,
          { id: id1, role: 'app', kind: 'text', text: step.app, stepId: step.id },
          { id: id2, role: 'app', kind: 'summary', text: '', stepId: step.id },
        ]);
      }, components.chatBubble.typing.durationMs);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(outer);
      if (inner !== undefined) clearTimeout(inner);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSummary, currentStep?.id]);

  const handleConfirm = useCallback(async () => {
    if (!flow || confirming) return;
    setConfirming(true);
    try {
      const { payload } = await confirmFlow(flow as never, answers, ctx);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeForm(true, answers, payload);
    } catch (err) {
      setConfirming(false);
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }, [flow, confirming, answers, ctx, closeForm]);

  const handleClose = useCallback(() => {
    if (Object.keys(answers).length > 0) {
      Alert.alert('Discard this?', 'Your answers will be lost.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => closeForm(false) },
      ]);
    } else {
      closeForm(false);
    }
  }, [answers, closeForm]);

  const handleUndo = useCallback(() => {
    const lastUserIdx = [...messages].map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx === -1) return;
    const removed = messages[lastUserIdx];
    if (removed?.stepId) {
      const idx = steps.findIndex((s) => s.id === removed.stepId);
      if (idx >= 0) {
        setAnswers((a) => {
          const next = { ...a };
          for (const s of steps.slice(idx)) if (s.field) delete next[s.field];
          return next;
        });
        setCursor(idx);
      }
    }
    setMessages((prev) => prev.slice(0, lastUserIdx));
  }, [messages, steps]);

  const handleRewind = useCallback(
    (stepId: string | undefined) => {
      if (!stepId) return;
      const idx = steps.findIndex((s) => s.id === stepId);
      if (idx < 0) return;
      setMessages((prev) => {
        const cut = prev.findIndex((m) => m.role === 'user' && m.stepId === stepId);
        const base = cut >= 0 ? prev.slice(0, cut) : prev;
        return base;
      });
      setAnswers((a) => {
        const next = { ...a };
        for (const s of steps.slice(idx)) if (s.field) delete next[s.field];
        return next;
      });
      setCursor(idx);
    },
    [steps],
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.role === 'app' && item.kind === 'summary') {
      return <SummaryCard answers={answers} ctx={ctx} />;
    }
    const isUser = item.role === 'user';
    const bubbleBg = isUser
      ? String(ctx.userBubbleColor ?? colors.accent)
      : colors.bubbleApp;
    const textColor = isUser ? '#FFFFFF' : colors.bubbleAppText;
    return (
      <Pressable
        onPress={isUser ? () => handleRewind(item.stepId) : undefined}
        disabled={!isUser}
        accessibilityRole={isUser ? 'button' : undefined}
        accessibilityHint={isUser ? 'Tap to change this answer' : undefined}
        style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleApp, { backgroundColor: bubbleBg }]}
      >
        {item.visual?.type === 'avatar' ? (
          <AvatarGlyph avatar={getAvatar(item.visual.value)} size={40} color={textColor} />
        ) : item.visual?.type === 'color' ? (
          <View style={[styles.colorDot, { backgroundColor: getProjectColor(item.visual.value).hex }]} />
        ) : (
          <AppText type="body" color={textColor as never}>
            {item.text}
          </AppText>
        )}
      </Pressable>
    );
  };

  const dockProps: DockProps | null = currentStep
    ? { step: currentStep, answers, ctx, onAnswer: handleAnswer, onSkip: handleSkip }
    : null;

  const renderDock = () => {
    if (!currentStep || isSummary) {
      if (isSummary) {
        return (
          <View style={styles.dock}>
            <Pressable
              onPress={() => handleRewind(steps[steps.length - 2]?.id)}
              style={styles.chipButton}
              accessibilityRole="button"
            >
              <AppText type="label" color="textSecondary">Change something</AppText>
            </Pressable>
            <Pressable
              onPress={() => void handleConfirm()}
              disabled={confirming}
              style={[styles.confirmButton, confirming && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel={String((currentStep as FlowStep & { confirm?: string }).confirm ?? 'Confirm')}
            >
              <AppText type="label" color={colors.onAccent}>
                {confirming ? 'Saving…' : String((currentStep as FlowStep & { confirm?: string }).confirm ?? 'Confirm')}
              </AppText>
            </Pressable>
          </View>
        );
      }
      return <View style={styles.dock} />;
    }
    switch (currentStep.type) {
      case 'text': return <TextDock {...dockProps!} />;
      case 'multiline': return <MultilineDock {...dockProps!} />;
      case 'chips': return <ChipsDock {...dockProps!} />;
      case 'colorSwatch': return <ColorSwatchDock {...dockProps!} />;
      case 'avatar': return <AvatarDock {...dockProps!} />;
      case 'date': return <DateDock {...dockProps!} />;
      case 'time': return <TimeDock {...dockProps!} />;
      case 'money': return <MoneyDock {...dockProps!} />;
      case 'paste': return <PasteDock {...dockProps!} />;
      case 'attach': return <AttachDock {...dockProps!} />;
      default: return <View style={styles.dock} />;
    }
  };

  if (!open || !flow) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      {/* Android modals don't resize for the IME — shrink the whole form instead */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {/* header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.headerBtn}>
            <AppText type="heading" color="textPrimary">✕</AppText>
          </Pressable>
          <AppText type="label" color="textPrimary" style={styles.headerTitle}>
            {flow.title}
          </AppText>
          <Pressable
            onPress={handleUndo}
            disabled={!messages.some((m) => m.role === 'user')}
            accessibilityRole="button"
            accessibilityLabel="Back one step"
            style={styles.headerBtn}
          >
            <AppText type="heading" color={messages.some((m) => m.role === 'user') ? 'textPrimary' : 'textTertiary'}>↩</AppText>
          </Pressable>
        </View>

        {/* messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            typing ? (
              <View style={[styles.bubble, styles.bubbleApp, styles.typing]}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.dot} />
                ))}
              </View>
            ) : undefined
          }
        />

        {/* input dock */}
        {renderDock()}
      </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SummaryCard({ answers, ctx }: { answers: Answers; ctx: Record<string, unknown> }) {
  const entries = Object.entries(answers).filter(([, v]) => v !== null && v !== undefined && v !== '');
  return (
    <View style={styles.summaryCard}>
      {entries.map(([field, value]) => (
        <View key={field} style={styles.summaryRow}>
          <AppText type="caption" color="textSecondary">{FIELD_LABELS[field] ?? field}</AppText>
          <AppText type="body" color="textPrimary" style={styles.summaryValue}>
            {field === 'avatar_key'
              ? (() => { const a = getAvatar(String(value)); return a.emoji ? `${a.emoji} ${a.label}` : a.label; })()
              : field === 'color_key'
                ? String(value)
                : formatAnswerValue(field, value, ctx)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center' },
  list: { padding: spacing.xl, gap: spacing.md, flexGrow: 1 },
  bubble: {
    maxWidth: '82%',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bubbleApp: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: 6,
    backgroundColor: colors.bubbleApp,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    borderTopRightRadius: 6,
    backgroundColor: colors.accent,
  },
  typing: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: spacing.lg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textTertiary },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...{
      shadowColor: '#111114',
      shadowOpacity: 0.08,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  summaryValue: { flexShrink: 1, textAlign: 'right' },
  dock: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chipButton: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  confirmButton: {
    minHeight: components.button.primary.height,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
