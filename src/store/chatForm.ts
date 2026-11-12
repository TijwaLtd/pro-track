import { create } from 'zustand';
import type { Answers, EvalContext } from '../components/chat/eval';
import type { FlowName } from '../components/chat/flows';

export type ChatFormResult = { flow: FlowName; answers: Answers; payload?: Record<string, unknown> } | null;

interface ChatFormStore {
  open: boolean;
  flow: FlowName | null;
  context: EvalContext;
  firstRun: boolean;
  /** Called with the confirmed answers, or null when discarded. */
  onResult: ((result: ChatFormResult) => void) | null;
  openForm: (flow: FlowName, context?: EvalContext, opts?: { firstRun?: boolean; onResult?: (r: ChatFormResult) => void }) => void;
  closeForm: (confirmed: boolean, answers?: Answers, payload?: Record<string, unknown>) => void;
}

export const useChatFormStore = create<ChatFormStore>((set, get) => ({
  open: false,
  flow: null,
  context: {},
  firstRun: false,
  onResult: null,
  openForm: (flow, context = {}, opts = {}) =>
    set({ open: true, flow, context, firstRun: Boolean(opts.firstRun), onResult: opts.onResult ?? null }),
  closeForm: (confirmed, answers, payload) => {
    const { flow, onResult } = get();
    set({ open: false, flow: null, context: {}, firstRun: false, onResult: null });
    onResult?.(confirmed && flow ? { flow, answers: answers ?? {}, payload } : null);
  },
}));
