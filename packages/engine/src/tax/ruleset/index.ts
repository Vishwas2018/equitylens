export type {
  ProcessedBracket,
  SurchargeBracket,
  ProcessedMedicareLevy,
  LandTaxBracket,
  VicLandTaxConfig,
  Ruleset,
  RulesetVersion,
  RawBracket,
  RawLandTaxBracket,
  RawRuleset,
} from './types.js';

export { RulesetAdapter } from './adapter.js';

import { RulesetAdapter } from './adapter.js';
import fy2026 from './data/fy2026.json' assert { type: 'json' };
import type { RawRuleset } from './types.js';

/** Default adapter pre-loaded with all published rulesets. */
export const defaultRulesetAdapter = new RulesetAdapter([fy2026 as unknown as RawRuleset]);
