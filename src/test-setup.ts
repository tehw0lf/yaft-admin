import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

// Setup navigator.clipboard mock
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn()
  },
  writable: true
});

// Helper to create jasmine-like spy
function createJasmineLikeSpy(fn?: Function) {
  const mockFn = fn ? jest.fn(fn) : jest.fn();
  mockFn.and = {
    returnValue: (value: any) => {
      mockFn.mockReturnValue(value);
      return mockFn;
    },
    returnValues: (...values: any[]) => {
      mockFn.mockReturnValueOnce(values[0]);
      values.slice(1).forEach(value => mockFn.mockReturnValueOnce(value));
      return mockFn;
    },
    throwError: (error: any) => {
      mockFn.mockImplementation(() => { throw error; });
      return mockFn;
    },
    callFake: (fn: Function) => {
      mockFn.mockImplementation(fn);
      return mockFn;
    }
  };
  return mockFn;
}

// Setup jasmine globals for Jest
Object.assign(global, {
  jasmine: {
    createSpyObj: jest.fn().mockImplementation((baseName, methodNames, propertyNames) => {
      const obj: any = {};
      
      // Add methods as Jest mocks with jasmine-like interface
      if (Array.isArray(methodNames)) {
        methodNames.forEach(methodName => {
          obj[methodName] = createJasmineLikeSpy();
        });
      }
      
      // Add properties
      if (propertyNames) {
        Object.keys(propertyNames).forEach(propName => {
          obj[propName] = propertyNames[propName];
        });
      }
      
      return obj;
    }),
    createSpy: jest.fn().mockImplementation((name?) => {
      return createJasmineLikeSpy();
    })
  },
  spyOn: (obj: any, methodName: string) => {
    const originalMethod = obj[methodName];
    const spy = createJasmineLikeSpy();
    obj[methodName] = spy;
    return spy;
  }
});
