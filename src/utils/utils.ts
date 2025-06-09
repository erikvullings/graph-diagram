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

export const titleToFilename = (title: string, extension: string): string => {
  // Sanitize title: remove unsafe characters, trim, and replace spaces with dashes
  const safeTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with dashes
    .replace(/-+/g, "-"); // Collapse multiple dashes

  // Ensure extension starts with a dot
  const safeExtension = extension.startsWith(".") ? extension : `.${extension}`;

  return `${safeTitle}${safeExtension}`;
};
