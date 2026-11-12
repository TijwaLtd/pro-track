import spec from '../../../design/chat-forms.json';
import type { Answers, EvalContext } from './eval';
import { evalVisible } from './eval';

export type FlowName = keyof typeof spec.flows;
export type StepType =
  | 'none' | 'text' | 'multiline' | 'colorSwatch' | 'avatar' | 'chips'
  | 'date' | 'time' | 'money' | 'paste' | 'attach' | 'summaryCard';

export interface FlowStep {
  id: string;
  app: string;
  type: StepType;
  field?: string;
  optional?: boolean;
  required?: boolean;
  visibleIf?: string;
  chips?: string[];
  chipsVisibleIf?: string;
  default?: unknown;
  currency?: string;
  maxLength?: number;
  [key: string]: unknown;
}

export interface FlowDef {
  title: string;
  steps: FlowStep[];
  firstRun?: string;
  maxQuestionsShown?: number;
  note?: string;
}

export const flows: Record<FlowName, FlowDef> = spec.flows as never;

export function getFlow(name: FlowName): FlowDef {
  return flows[name];
}

/** Steps currently visible given answers + context. */
export function visibleSteps(flow: FlowDef, answers: Answers, ctx: EvalContext): FlowStep[] {
  return flow.steps.filter((s) => evalVisible(s.visibleIf, answers, ctx));
}
