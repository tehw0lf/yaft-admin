import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function timeRangeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    // Get separate date and time values
    const activeAtDate = control.get('activeAtDate')?.value;
    const activeAtTime = control.get('activeAtTime')?.value;
    const disabledAtDate = control.get('disabledAtDate')?.value;
    const disabledAtTime = control.get('disabledAtTime')?.value;

    // Only validate if both active and disabled dates are provided
    if (!activeAtDate || !disabledAtDate) {
      return null; // If either date is empty, no validation needed
    }

    // Combine date and time
    const activeDate = new Date(activeAtDate);
    const disabledDate = new Date(disabledAtDate);
    
    if (activeAtTime) {
      const [activeHours, activeMinutes] = activeAtTime.split(':');
      activeDate.setHours(parseInt(activeHours, 10), parseInt(activeMinutes, 10), 0, 0);
    } else {
      activeDate.setHours(0, 0, 0, 0);
    }
    
    if (disabledAtTime) {
      const [disabledHours, disabledMinutes] = disabledAtTime.split(':');
      disabledDate.setHours(parseInt(disabledHours, 10), parseInt(disabledMinutes, 10), 0, 0);
    } else {
      disabledDate.setHours(0, 0, 0, 0);
    }

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