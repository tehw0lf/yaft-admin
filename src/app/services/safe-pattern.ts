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
 * Compiles `pattern` if it is safe to execute, otherwise returns null.
 *
 * Returning the compiled RegExp - rather than a boolean the caller then
 * recompiles - keeps construction in one place, so a screened pattern cannot
 * drift apart from the one actually executed.
 *
 * Conservative by design: it may reject an exotic-but-harmless pattern, which
 * surfaces as a validation error rather than a frozen tab.
 */
export function compileSafePattern(pattern: string): RegExp | null {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return null;
  }

  if (NESTED_QUANTIFIER.test(pattern)) {
    return null;
  }

  // More than a handful of unbounded quantifiers gives backtracking too much
  // room even without a nested group.
  const unboundedQuantifiers = (pattern.match(/[+*]/g) ?? []).length;
  if (unboundedQuantifiers > 10) {
    return null;
  }

  try {
    // The pattern has passed every structural check above, so this is the one
    // place a screened pattern is turned into a RegExp.
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

/** Convenience wrapper for callers that only need the verdict. */
export function isSafePattern(pattern: string): boolean {
  return compileSafePattern(pattern) !== null;
}
