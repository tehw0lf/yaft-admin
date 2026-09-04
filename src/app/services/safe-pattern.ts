/**
 * Guards against ReDoS (catastrophic backtracking) in user-supplied validation
 * patterns.
 *
 * Template variable patterns are developer-authored in the built-in templates,
 * but `TemplateService.importTemplates()` accepts a template file from disk and
 * spreads its variables in unvalidated. A crafted `pattern` such as
 * `(a+)+$` therefore reaches `new RegExp(...).test(value)` and can hang the
 * browser tab on a modest input.
 *
 * JavaScript has no regex execution timeout, so the pattern has to be rejected
 * before it ever runs. Rather than trying to decide the general case, this
 * applies conservative structural limits that every legitimate validation
 * pattern in practice stays well within.
 */

/** Patterns longer than this are rejected outright. */
const MAX_PATTERN_LENGTH = 200;

/**
 * A quantified group that itself contains a quantifier - `(a+)+`, `(a*)*`,
 * `(a+){2,}` and friends. This nested-quantifier shape is the classic driver of
 * exponential backtracking.
 */
const NESTED_QUANTIFIER = /\([^()]*[+*}][^()]*\)\s*[+*]|\([^()]*[+*][^()]*\)\s*\{\d+,\}?/;

/**
 * Returns true when `pattern` is safe to compile and execute.
 *
 * Conservative by design: it may reject an exotic-but-harmless pattern, which
 * surfaces as a validation error rather than a frozen tab.
 */
export function isSafePattern(pattern: string): boolean {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return false;
  }

  if (NESTED_QUANTIFIER.test(pattern)) {
    return false;
  }

  // More than a handful of unbounded quantifiers gives backtracking too much
  // room even without a nested group.
  const unboundedQuantifiers = (pattern.match(/[+*]/g) ?? []).length;
  if (unboundedQuantifiers > 10) {
    return false;
  }

  // Must actually compile.
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
