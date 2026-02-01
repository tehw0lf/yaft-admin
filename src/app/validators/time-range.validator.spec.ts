import { FormControl, FormGroup } from '@angular/forms';
import { timeRangeValidator } from './time-range.validator';
describe('TimeRangeValidator', () => {
  let formGroup: FormGroup;
  beforeEach(() => {
    formGroup = new FormGroup({
      activeAt: new FormControl(''),
      disabledAt: new FormControl(''),
    });
  });
  it('should return null for valid time range', () => {
    const now = new Date();
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours later
    formGroup.patchValue({
      activeAt: now.toISOString().slice(0, 16),
      disabledAt: future.toISOString().slice(0, 16),
    });
    const validator = timeRangeValidator();
    const result = validator(formGroup);
    expect(result).toBeNull();
  });
  it('should return null when both dates are empty', () => {
    formGroup.patchValue({
      activeAt: '',
      disabledAt: '',
    });
    const validator = timeRangeValidator();
    const result = validator(formGroup);
    expect(result).toBeNull();
  });
  it('should return null when only activeAt is provided', () => {
    const future = new Date();
    future.setHours(future.getHours() + 1);
    formGroup.patchValue({
      activeAt: future.toISOString().slice(0, 16),
      disabledAt: '',
    });
    const validator = timeRangeValidator();
    const result = validator(formGroup);
    expect(result).toBeNull();
  });
  it('should return null when only disabledAt is provided', () => {
    const future = new Date();
    future.setHours(future.getHours() + 1);
    formGroup.patchValue({
      activeAt: '',
      disabledAt: future.toISOString().slice(0, 16),
    });
    const validator = timeRangeValidator();
    const result = validator(formGroup);
    expect(result).toBeNull();
  });
  it('should return error when disabledAt is before activeAt', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    formGroup.patchValue({
      activeAt: now.toISOString().slice(0, 16),
      disabledAt: past.toISOString().slice(0, 16),
    });
    const validator = timeRangeValidator();
    const result = validator(formGroup);
    expect(result).toEqual({
      timeRangeInvalid: {
        message: 'Active time must be before disabled time',
      },
    });
  });
  it('should return error when disabledAt equals activeAt', () => {
    const now = new Date();
    const timeString = now.toISOString().slice(0, 16);
    formGroup.patchValue({
      activeAt: timeString,
      disabledAt: timeString,
    });
    const validator = timeRangeValidator();
    const result = validator(formGroup);
    expect(result).toEqual({
      timeRangeInvalid: {
        message: 'Active time must be before disabled time',
      },
    });
  });
  it('should handle invalid date strings gracefully', () => {
    formGroup.patchValue({
      activeAt: 'invalid-date',
      disabledAt: 'also-invalid',
    });
    const validator = timeRangeValidator();
    const result = validator(formGroup);
    // Should not throw error and return null for invalid dates
    expect(result).toBeNull();
  });
  it('should work with FormGroup that has different control names', () => {
    const customFormGroup = new FormGroup({
      startTime: new FormControl(''),
      endTime: new FormControl(''),
    });
    const now = new Date();
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    customFormGroup.patchValue({
      startTime: now.toISOString().slice(0, 16),
      endTime: future.toISOString().slice(0, 16),
    });
    // Should return null since the validator looks for 'activeAt' and 'disabledAt' controls
    const validator = timeRangeValidator();
    const result = validator(customFormGroup);
    expect(result).toBeNull();
  });
  it('should handle millisecond differences correctly', () => {
    const now = new Date();
    const slightly_later = new Date(now.getTime() + 60 * 1000); // 1 minute later (datetime-local precision)
    formGroup.patchValue({
      activeAt: now.toISOString().slice(0, 16),
      disabledAt: slightly_later.toISOString().slice(0, 16),
    });
    const validator = timeRangeValidator();
    const result = validator(formGroup);
    // 1 minute difference should be valid
    expect(result).toBeNull();
  });
});
