type FocusableInputRef = {
  current: { focus: () => void } | null;
};

type DeferredFocusTask = {
  cancel: () => void;
};

type DeferredFocusScheduler = (callback: () => void) => DeferredFocusTask;

// Schedule focus only after opening interactions complete and cancel on close.
export function scheduleDeferredInputFocus(inputRef: FocusableInputRef, schedule: DeferredFocusScheduler): () => void {
  let cancelled = false;
  const task = schedule(() => {
    if (!cancelled) inputRef.current?.focus();
  });
  return () => {
    cancelled = true;
    task.cancel();
  };
}
