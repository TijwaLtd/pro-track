/**
 * Tiny evaluator for chat-forms.json `visibleIf` / `chipsVisibleIf` expressions.
 * Supported: `field`, `field set`, `field == value`, `field != value`,
 * `field in [a, b]`, `field > n`, `field < n`, `!field`.
 * Values come from answers plus a context object (project, item, outstanding...).
 */
export type Answers = Record<string, unknown>;
export type EvalContext = Record<string, unknown>;

function resolve(name: string, answers: Answers, ctx: EvalContext): unknown {
  if (name in answers) return answers[name];
  if (name in ctx) return ctx[name];
  return undefined;
}

function parseInList(raw: string): string[] {
  return raw
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

export function evalCondition(expr: string, answers: Answers, ctx: EvalContext = {}): boolean {
  const e = expr.trim();
  if (!e) return true;

  // `in [a, b]`
  const inMatch = e.match(/^(.+?)\s+in\s+\[(.*)\]$/i);
  if (inMatch) {
    const value = resolve(inMatch[1].trim(), answers, ctx);
    const list = parseInList(inMatch[2]);
    return list.some((v) => String(value) === v);
  }

  // comparisons
  const cmp = e.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (cmp) {
    const [, lhsRaw, op, rhsRaw] = cmp;
    const lhs = resolve(lhsRaw.trim(), answers, ctx);
    const rhs = rhsRaw.trim().replace(/^['"]|['"]$/g, '');
    const ln = typeof lhs === 'number' ? lhs : Number(lhs);
    const rn = Number(rhs);
    const bothNumeric = !Number.isNaN(ln) && !Number.isNaN(rn) && rhs !== '';
    switch (op) {
      case '==': return String(lhs) === rhs;
      case '!=': return String(lhs) !== rhs;
      case '>': return bothNumeric ? ln > rn : String(lhs) > rhs;
      case '<': return bothNumeric ? ln < rn : String(lhs) < rhs;
      case '>=': return bothNumeric ? ln >= rn : String(lhs) >= rhs;
      case '<=': return bothNumeric ? ln <= rn : String(lhs) <= rhs;
    }
  }

  // `field set` / `field unset`
  const setMatch = e.match(/^(.+?)\s+(set|unset)$/i);
  if (setMatch) {
    const v = resolve(setMatch[1].trim(), answers, ctx);
    const isSet = v !== undefined && v !== null && v !== '';
    return setMatch[2].toLowerCase() === 'set' ? isSet : !isSet;
  }

  // bare field / !field
  if (e.startsWith('!')) {
    const v = resolve(e.slice(1).trim(), answers, ctx);
    return !v;
  }
  const v = resolve(e, answers, ctx);
  return Boolean(v);
}

export function evalVisible(expr: string | undefined, answers: Answers, ctx: EvalContext = {}): boolean {
  if (!expr) return true;
  // support simple `&&` / `||` chains
  if (/\|\|/.test(expr)) return expr.split('||').some((p) => evalCondition(p, answers, ctx));
  if (/&&/.test(expr)) return expr.split('&&').every((p) => evalCondition(p, answers, ctx));
  return evalCondition(expr, answers, ctx);
}
