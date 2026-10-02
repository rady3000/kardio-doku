// The six modules (CLAUDE.md, SPEC-shared §1). `milestone` is when the form arrives.

export const MODULE_KEYS = ['tte', 'device', 'tee', 'carotis', 'sm_impl', 'cv'] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface ModuleInfo {
  key: ModuleKey;
  name: string;
  milestone: string;
}

export const MODULES: readonly ModuleInfo[] = [
  { key: 'tte', name: 'Transthorakale Echokardiographie (TTE)', milestone: 'M2' },
  { key: 'device', name: 'Device-Abfrage', milestone: 'M3' },
  { key: 'tee', name: 'Transösophageale Echokardiographie (TEE)', milestone: 'M5' },
  { key: 'sm_impl', name: 'Schrittmacher-Implantation', milestone: 'M6' },
  { key: 'cv', name: 'Elektrische Kardioversion', milestone: 'M7' },
  { key: 'carotis', name: 'Karotis-Duplexsonographie', milestone: 'M8' },
];

export function moduleName(key: string): string {
  return MODULES.find((m) => m.key === key)?.name ?? key;
}
