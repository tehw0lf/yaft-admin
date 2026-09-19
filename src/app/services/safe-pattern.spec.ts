import { compileSafePattern, isSafePattern } from './safe-pattern';

describe('isSafePattern', () => {
  it('rejects patterns with nested quantifiers', () => {
    expect(isSafePattern('(a+)+$')).toBe(false);
    expect(isSafePattern('(a*)*$')).toBe(false);
    expect(isSafePattern('([a-zA-Z]+)*$')).toBe(false);
    expect(isSafePattern('(a+){2,}')).toBe(false);
    expect(isSafePattern('(x+x+)+y')).toBe(false);
  });

  it('rejects an optional quantifier inside a quantified group', () => {
    // `?` is a quantifier too. `(a?a?)+$` takes over 20 seconds on 24
    // characters, so it has to be rejected before it ever runs.
    expect(isSafePattern('(a?a?)+$')).toBe(false);
    expect(isSafePattern('(a?)+$')).toBe(false);
    expect(isSafePattern('(aa?)+$')).toBe(false);
    expect(isSafePattern('(a?)*$')).toBe(false);
  });

  it('rejects a nested quantifier behind a group prefix', () => {
    expect(isSafePattern('(?:a+)+$')).toBe(false);
    expect(isSafePattern('(?:a?a?)+$')).toBe(false);
    expect(isSafePattern('(?<name>a+)+$')).toBe(false);
  });

  it('rejects a quantifier nested one group deeper', () => {
    expect(isSafePattern('((a+))+$')).toBe(false);
  });

  it('accepts a group whose prefix is the only question mark', () => {
    // The `?` opens the group rather than quantifying anything in it.
    expect(isSafePattern('(?:ab)+$')).toBe(true);
    expect(isSafePattern('(?=a)b')).toBe(true);
    expect(isSafePattern('(?!x)ab$')).toBe(true);
    expect(isSafePattern('(?<=a)b')).toBe(true);
    expect(isSafePattern('(?<name>ab)+$')).toBe(true);
  });

  it('accepts an escaped quantifier, which is a literal', () => {
    expect(isSafePattern('(a\\+)+$')).toBe(true);
    expect(isSafePattern('(a\\?)+$')).toBe(true);
    expect(isSafePattern('(a\\*)+$')).toBe(true);
  });

  it('accepts a quantifier that applies to a literal, not the group', () => {
    // Whitespace is an atom, so the `+` here repeats the space.
    expect(isSafePattern('(a+) +$')).toBe(true);
  });

  it('accepts a nested group prefix and class literals in the body', () => {
    expect(isSafePattern('((?:ab))+$')).toBe(true);
    expect(isSafePattern('([?])+$')).toBe(true);
    expect(isSafePattern('([+*])+$')).toBe(true);
  });

  it('accepts a fixed repetition, which cannot overlap', () => {
    expect(isSafePattern('(ab){2}$')).toBe(true);
    expect(isSafePattern('(a{2}){3}$')).toBe(true);
  });

  it('rejects a variable bounded quantifier inside a repeated group', () => {
    expect(isSafePattern('(a{1,2})+$')).toBe(false);
    expect(isSafePattern('(a{2,})+$')).toBe(false);
  });

  it('rejects overly long patterns', () => {
    expect(isSafePattern('a'.repeat(201))).toBe(false);
  });

  it('rejects patterns with too many unbounded quantifiers', () => {
    expect(isSafePattern('a*b*c*d*e*f*g*h*i*j*k*l*')).toBe(false);
  });

  it('rejects syntactically invalid patterns', () => {
    expect(isSafePattern('([unclosed')).toBe(false);
  });

  it('accepts the validation patterns used by built-in templates', () => {
    expect(isSafePattern('^[a-z0-9-_]+$')).toBe(true);
    expect(isSafePattern('^\\d{4}-\\d{2}-\\d{2}$')).toBe(true);
    expect(isSafePattern('^.{3,50}$')).toBe(true);
    expect(isSafePattern('^(foo|bar)$')).toBe(true);
  });

  describe('compileSafePattern', () => {
    it('returns a usable RegExp for a safe pattern', () => {
      const re = compileSafePattern('^[a-z0-9-_]+$');
      expect(re).toBeInstanceOf(RegExp);
      expect(re?.test('valid-key_1')).toBe(true);
      expect(re?.test('Invalid Key!')).toBe(false);
    });

    it('returns null for ReDoS-prone and invalid patterns', () => {
      expect(compileSafePattern('(a+)+$')).toBeNull();
      expect(compileSafePattern('([unclosed')).toBeNull();
    });
  });
});
