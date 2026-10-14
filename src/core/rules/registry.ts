/// <reference types="vite/client" />
// Loads and validates every rule set in reference/*.json at build time.
import { validateRuleSet, type RuleSet } from './ruleSet';

const files = import.meta.glob('../../../reference/*.json', { eager: true, import: 'default' });

export interface RuleRegistry {
  rules: Map<string, RuleSet>;
  /** Validation problems per file; a module using an invalid rule set must not run. */
  problems: string[];
}

export function loadRules(raw: Record<string, unknown> = files): RuleRegistry {
  const rules = new Map<string, RuleSet>();
  const problems: string[] = [];
  for (const [path, content] of Object.entries(raw)) {
    const name = path.split('/').pop()!;
    const issues = validateRuleSet(content);
    if (issues.length) {
      problems.push(...issues.map((i) => `${name}: ${i}`));
      continue;
    }
    const rule = content as RuleSet;
    if (`${rule.id}.json` !== name) problems.push(`${name}: id "${rule.id}" does not match the file name`);
    if (rules.has(rule.id)) problems.push(`${name}: duplicate id "${rule.id}"`);
    rules.set(rule.id, rule);
  }
  return { rules, problems };
}

export const RULES: RuleRegistry = loadRules();
