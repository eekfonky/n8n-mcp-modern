// Test file demonstrating TypeScript best practices
// All issues have been resolved with modern TypeScript patterns

// Define proper interface instead of 'any'
interface DataObject {
  someProperty: unknown;
}

// Issue 1: Fixed - Using proper typed interface instead of 'any'
function processData(data: DataObject): unknown {
  return data.someProperty;
}

// Issue 2: Fixed - Added explicit parameter type annotation
function badFunction(param: number): number {
  return param + 1;
}

// Issue 3: Fixed - Removed unused variable
function withUnusedVar(): string {
  return "something else";
}

// Issue 4: Fixed - Added proper null safety check
function _riskyAccess(obj: { prop?: string }): number {
  if (!obj.prop) {
    throw new Error("Property is undefined or null");
  }
  return obj.prop.length;
}

// Issue 5: Fixed - Added explicit return type annotation
function _noReturnType(x: number, y: number): number {
  return x + y;
}

// Issue 6: Fixed - Added null checking with proper error handling
function _potentialNullAccess(arr: string[] | null): number {
  if (arr === null) {
    throw new Error("Array is null");
  }
  return arr.length;
}

// Issue 7: Fixed - Using modern method shorthand syntax
interface ObjectWithMethod {
  method(): ObjectWithMethod;
}

const _obj: ObjectWithMethod = {
  method(): ObjectWithMethod {
    // Modern method shorthand syntax with explicit return type
    return this;
  },
};

// Issue 8: Good pattern - Type guard with proper validation (already correct)
function _unsafeTypeAssertion(value: unknown): string {
  // Type guard for safe type assertion
  if (typeof value !== "string") {
    throw new TypeError("Expected string value");
  }
  return value.toUpperCase();
}

export { processData, badFunction, withUnusedVar };
