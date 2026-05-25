"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextType {
  showToast: (
    message: string,
    type?: "success" | "error" | "info",
  ) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_TTL_MS = 3000;

/**
 * Generates a collision-free toast id.
 *
 * Old code used Date.now().toString(): two toasts fired in the same
 * millisecond got the same React `key` and one would visually replace
 * the other (mount/unmount glitch). crypto.randomUUID is universally
 * available on every browser since 2022, with a tiny fallback for the
 * <1% of older mobile browsers.
 */
function makeToastId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Track timers so we can clean them up if the provider unmounts —
  // prevents "set state on unmounted component" warnings when navigating
  // away while a toast is still on screen.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback<ToastContextType["showToast"]>(
    (message, type = "success") => {
      const id = makeToastId();
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = setTimeout(() => dismiss(id), TOAST_TTL_MS);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="toast-container"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            role={t.type === "error" ? "alert" : undefined}
            onClick={() => dismiss(t.id)}
          >
            <span className="toast-icon" aria-hidden="true">
              {t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
