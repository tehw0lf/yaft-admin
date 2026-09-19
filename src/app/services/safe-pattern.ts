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

/** Group openings that are not capturing: `(?:`, `(?=`, `(?!`, `(?<=`, `(?<!`, `(?<name>`. */
const GROUP_PREFIX = /^\?(?::|=|!|<=|<!|<[A-Za-z_$][\w$]*>)/;

/**
 * A quantifier directly after a group: `+`, `*`, `{2,}`, `{1,2}`.
 *
 * No leading `\s*`: whitespace is a literal atom in a regex, so in `(a+) +$`
 * the `+` quantifies the space and the group is not repeated at all.
 */
const TRAILING_QUANTIFIER = /^(?:[+*]|\{(\d+)(,(\d*))?\})/;

/**
 * Whether `pattern` contains a quantified group that itself holds a quantifier
 * - `(a+)+`, `(a*)*`, `(a?a?)+`, `(a+){2,}` and friends. That nested shape is
 * the classic driver of exponential backtracking.
 *
 * This scans rather than matching one regex, because the shapes that have to be
 * told apart do not survive a single expression:
 *
 * - `?` counts as an inner quantifier, so `(a?a?)+$` is caught. It is not
 *   theoretical: that pattern takes over 20 seconds on 24 characters, while
 *   `(a?)+$` alone is cheap because the engine drops an empty loop body.
 * - But `?` also opens a non-capturing or look-around group, and `(?:ab)+$` is
 *   perfectly safe, so the prefix is skipped before the body is examined.
 * - A nested group still counts, so `((a+))+$` is caught.
 * - An escaped quantifier is a literal, so `(a\+)+$` is safe.
 */
function hasNestedQuantifier(pattern: string): boolean {
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '\\') {
      i++;
      continue;
    }
    if (pattern[i] !== '(') continue;

    let cursor = i + 1;
    const prefix = GROUP_PREFIX.exec(pattern.slice(cursor));
    if (prefix) cursor += prefix[0].length;

    // The group body, nested groups and all, up to this group's own ')'.
    let body = '';
    let depth = 0;
    let end = cursor;
    let inClass = false;
    for (; end < pattern.length; end++) {
      const char = pattern[end];
      if (char === '\\') {
        body += char + (pattern[end + 1] ?? '');
        end++;
        continue;
      }
      if (inClass) {
        if (char === ']') inClass = false;
      } else if (char === '[') inClass = true;
      else if (char === '(') depth++;
      else if (char === ')') {
        if (depth === 0) break;
        depth--;
      }
      body += char;
    }

    // Unterminated group: new RegExp() rejects it later anyway.
    if (end >= pattern.length) continue;
    const trailing = TRAILING_QUANTIFIER.exec(pattern.slice(end + 1));
    if (!trailing) continue;

    // `{n}` repeats a fixed number of times and cannot overlap, so it does not
    // open the door to backtracking the way `{n,}` and `{n,m}` do.
    const [, min, comma, max] = trailing;
    if (min !== undefined && !comma) continue;

    if (bodyHasQuantifier(body)) return true;
  }
  return false;
}

/**
 * Whether a group body contains a quantifier of its own.
 *
 * Has to know the same syntax the outer scan does, or it mistakes punctuation
 * for an operator: `?` opens a nested group in `((?:ab))+$`, and inside a
 * character class every one of `?`, `+`, `*` is an ordinary literal, so
 * `([?])+$` and `([+*])+$` are safe.
 */
function bodyHasQuantifier(body: string): boolean {
  let inClass = false;
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === '\\') {
      i++;
      continue;
    }
    if (inClass) {
      if (char === ']') inClass = false;
      continue;
    }
    if (char === '[') {
      inClass = true;
      continue;
    }
    if (char === '(') {
      // Skip a nested group's prefix so its `?` is not read as a quantifier.
      const prefix = GROUP_PREFIX.exec(body.slice(i + 1));
      if (prefix) i += prefix[0].length;
      continue;
    }
    if (char === '+' || char === '*' || char === '?') return true;
    // `{n,}` and `{n,m}` can overlap; a fixed `{n}` cannot.
    const braces = /^\{\d+,\d*\}/.exec(body.slice(i));
    if (braces) return true;
  }
  return false;
}

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

  if (hasNestedQuantifier(pattern)) {
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
