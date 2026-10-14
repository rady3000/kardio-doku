// Module registry. Adding a module = adding its schema file here.
import type { ModuleSchema } from '../core/schema';
import { tte } from './tte';

export const MODULE_SCHEMAS: ReadonlyMap<string, ModuleSchema> = new Map([[tte.key, tte]]);
