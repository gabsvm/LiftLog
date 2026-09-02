type FocusableInputRef = {
  current: { focus: () => void } | null;
};

type DeferredFocusTask = {
  cancel: () => void;
};

type DeferredFocusScheduler = (
  callback: () => void,
) => DeferredFocusTask;

export function scheduleDeferredInputFocus(
  inputRef: FocusableInputRef,
  schedule: DeferredFocusScheduler,
): () => void {
  const task = schedule(() => inputRef.current?.focus());
  return () => task.cancel();
}
