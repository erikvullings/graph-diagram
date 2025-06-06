export * from "./layout-manager";
export * from "./graph-parser";

/**
 * Debounce a function, i.e. wait for a certain amount of time before executing the function.
 * Often used when frequent edits would trigger a function multiple times, you can use this to
 * wait for a certain amount of time before executing the function.
 *
 * @param func The function to be debounced.
 * @param delay The delay in milliseconds for the debounce.
 * @returns A function that debounces the original function.
 * @example const debouncedFunc = debounce(myFunction, 100); debouncedFunc();
 */
export const debounce = <T extends Function & ((...args: any) => any)>(
  /** The function to be debounced. */
  func: T,
  /** The delay in milliseconds for the debounce. */
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeout: number | null;

  return ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, delay);
  }) as unknown as (...args: Parameters<T>) => void;
};
