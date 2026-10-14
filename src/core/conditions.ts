// Conditions used by module schemas (visibility, sentence selection, derived
// values). Pure data; evaluated against resolved values.

export type Cond =
  | { filled: string }
  | { empty: string }
  | { eq: [string, string | number] }
  | { in: [string, readonly string[]] }
  | { notIn: [string, readonly string[]] }
  | { cat: [string, string | readonly string[]] }
  | { gt: [string, number] }
  | { gte: [string, number] }
  | { lt: [string, number] }
  | { lte: [string, number] }
  | { all: readonly Cond[] }
  | { any: readonly Cond[] }
  | { not: Cond };

export type Scalar = string | number;

/** Resolves a key to a value: fields, derived values and `sex` (from the patient). */
export interface Resolver {
  value(key: string): Scalar | undefined;
  category(ruleId: string): string | undefined;
}

export function evaluate(cond: Cond, r: Resolver): boolean {
  if ('filled' in cond) return r.value(cond.filled) !== undefined;
  if ('empty' in cond) return r.value(cond.empty) === undefined;
  if ('eq' in cond) return r.value(cond.eq[0]) === cond.eq[1];
  if ('in' in cond) {
    const v = r.value(cond.in[0]);
    return typeof v === 'string' && cond.in[1].includes(v);
  }
  if ('notIn' in cond) {
    const v = r.value(cond.notIn[0]);
    return v !== undefined && !(typeof v === 'string' && cond.notIn[1].includes(v));
  }
  if ('cat' in cond) {
    const c = r.category(cond.cat[0]);
    const want = cond.cat[1];
    return c !== undefined && (typeof want === 'string' ? c === want : want.includes(c));
  }
  if ('gt' in cond) return num(r, cond.gt[0], (v) => v > cond.gt[1]);
  if ('gte' in cond) return num(r, cond.gte[0], (v) => v >= cond.gte[1]);
  if ('lt' in cond) return num(r, cond.lt[0], (v) => v < cond.lt[1]);
  if ('lte' in cond) return num(r, cond.lte[0], (v) => v <= cond.lte[1]);
  if ('all' in cond) return cond.all.every((c) => evaluate(c, r));
  if ('any' in cond) return cond.any.some((c) => evaluate(c, r));
  return !evaluate(cond.not, r);
}

function num(r: Resolver, key: string, test: (v: number) => boolean): boolean {
  const v = r.value(key);
  return typeof v === 'number' && test(v);
}

/** Keys a condition refers to (for schema validation). */
export function condKeys(cond: Cond): { keys: string[]; rules: string[] } {
  const keys: string[] = [];
  const rules: string[] = [];
  const walk = (c: Cond) => {
    if ('filled' in c) keys.push(c.filled);
    else if ('empty' in c) keys.push(c.empty);
    else if ('eq' in c) keys.push(c.eq[0]);
    else if ('in' in c) keys.push(c.in[0]);
    else if ('notIn' in c) keys.push(c.notIn[0]);
    else if ('cat' in c) rules.push(c.cat[0]);
    else if ('gt' in c) keys.push(c.gt[0]);
    else if ('gte' in c) keys.push(c.gte[0]);
    else if ('lt' in c) keys.push(c.lt[0]);
    else if ('lte' in c) keys.push(c.lte[0]);
    else if ('all' in c) c.all.forEach(walk);
    else if ('any' in c) c.any.forEach(walk);
    else walk(c.not);
  };
  walk(cond);
  return { keys, rules };
}
