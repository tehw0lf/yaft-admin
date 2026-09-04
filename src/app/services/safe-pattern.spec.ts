import { isSafePattern } from './safe-pattern';

describe('isSafePattern', () => {
  it('rejects patterns with nested quantifiers', () => {
    expect(isSafePattern('(a+)+$')).toBe(false);
    expect(isSafePattern('(a*)*$')).toBe(false);
    expect(isSafePattern('([a-zA-Z]+)*$')).toBe(false);
    expect(isSafePattern('(a+){2,}')).toBe(false);
    expect(isSafePattern('(x+x+)+y')).toBe(false);
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
});
