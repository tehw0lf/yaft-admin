import { Injectable, ErrorHandler } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, timer } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

export interface RetryConfig {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier: number;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService implements ErrorHandler {
  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    delayMs: 1000,
    backoffMultiplier: 2
  };

  constructor(private snackBar: MatSnackBar) {}

  handleError(error: any): void {
    console.error('Global error handler:', error);
    
    let message = 'An unexpected error occurred';
    
    if (error instanceof HttpErrorResponse) {
      message = this.getHttpErrorMessage(error);
    } else if (error?.message) {
      message = error.message;
    }
    
    this.showErrorNotification(message);
  }

  showErrorNotification(message: string, duration = 5000): void {
    this.snackBar.open(message, 'Dismiss', {
      duration,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  showSuccessNotification(message: string, duration = 3000): void {
    this.snackBar.open(message, 'Dismiss', {
      duration,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  showWarningNotification(message: string, duration = 4000): void {
    this.snackBar.open(message, 'Dismiss', {
      duration,
      panelClass: ['warning-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  showInfoNotification(message: string, duration = 3000): void {
    this.snackBar.open(message, 'Dismiss', {
      duration,
      panelClass: ['info-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  retryOperation<T>(
    operation: () => Observable<T>,
    config: Partial<RetryConfig> = {}
  ): Observable<T> {
    const finalConfig = { ...this.defaultRetryConfig, ...config };
    
    return new Observable<T>(observer => {
      let attempt = 0;
      
      const tryOperation = () => {
        operation().subscribe({
          next: value => observer.next(value),
          complete: () => observer.complete(),
          error: error => {
            attempt++;
            
            if (attempt <= finalConfig.maxRetries) {
              const delay = finalConfig.delayMs * Math.pow(finalConfig.backoffMultiplier, attempt - 1);
              
              console.log(`Retry attempt ${attempt}/${finalConfig.maxRetries} in ${delay}ms`);
              
              timer(delay).subscribe(() => tryOperation());
            } else {
              console.error(`Operation failed after ${finalConfig.maxRetries} retries:`, error);
              observer.error(error);
            }
          }
        });
      };
      
      tryOperation();
    });
  }

  private getHttpErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Network error: Please check your internet connection';
    }
    
    if (error.status >= 400 && error.status < 500) {
      switch (error.status) {
        case 400:
          return error.error?.message || 'Bad request: Please check your input';
        case 401:
          return 'Unauthorized: Please check your credentials';
        case 403:
          return 'Forbidden: You don\'t have permission to perform this action';
        case 404:
          return 'Not found: The requested resource was not found';
        case 409:
          return error.error?.message || 'Conflict: Resource already exists';
        case 422:
          return error.error?.message || 'Validation error: Please check your input';
        default:
          return error.error?.message || `Client error (${error.status})`;
      }
    }
    
    if (error.status >= 500) {
      switch (error.status) {
        case 500:
          return 'Server error: Something went wrong on the server';
        case 502:
          return 'Bad gateway: Server is temporarily unavailable';
        case 503:
          return 'Service unavailable: Server is temporarily down';
        case 504:
          return 'Gateway timeout: Server took too long to respond';
        default:
          return `Server error (${error.status})`;
      }
    }
    
    return error.error?.message || error.message || 'An unknown error occurred';
  }

  // Helper method to handle common async operation patterns
  handleAsyncOperation<T>(
    operation: () => Observable<T>,
    options: {
      loadingMessage?: string;
      successMessage?: string;
      errorMessage?: string;
      retryConfig?: Partial<RetryConfig>;
    } = {}
  ): Observable<T> {
    if (options.loadingMessage) {
      this.showInfoNotification(options.loadingMessage);
    }

    const operationWithRetry = options.retryConfig 
      ? this.retryOperation(operation, options.retryConfig)
      : operation();

    return new Observable<T>(observer => {
      operationWithRetry.subscribe({
        next: value => {
          if (options.successMessage) {
            this.showSuccessNotification(options.successMessage);
          }
          observer.next(value);
        },
        complete: () => observer.complete(),
        error: error => {
          const message = options.errorMessage || this.getHttpErrorMessage(error);
          this.showErrorNotification(message);
          observer.error(error);
        }
      });
    });
  }
}

// Global error handler configuration
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private errorHandlerService: ErrorHandlerService) {}

  handleError(error: any): void {
    this.errorHandlerService.handleError(error);
  }
}