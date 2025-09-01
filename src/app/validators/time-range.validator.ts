import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function timeRangeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const activeAt = control.get('activeAt')?.value;
    const disabledAt = control.get('disabledAt')?.value;

    if (!activeAt || !disabledAt) {
      return null; // If either is empty, no validation needed
    }

    const activeDate = new Date(activeAt);
    const disabledDate = new Date(disabledAt);

    if (activeDate >= disabledDate) {
      return { timeRangeInvalid: { 
        message: 'Active time must be before disabled time' 
      }};
    }

    return null;
  };
}

export function futureDateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }

    const inputDate = new Date(control.value);
    const now = new Date();

    if (inputDate <= now) {
      return { 
        pastDate: { 
          message: 'Date must be in the future' 
        } 
      };
    }

    return null;
  };
}