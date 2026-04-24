import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
  type ClipboardEvent,
} from "react";
import { cn } from "@/lib/utils";

export interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  ariaLabel?: string;
}

export interface PinInputHandle {
  focus: () => void;
  clear: () => void;
}

export const PinInput = forwardRef<PinInputHandle, PinInputProps>(
  function PinInput(
    {
      value,
      onChange,
      onComplete,
      length = 4,
      disabled,
      autoFocus,
      className,
      ariaLabel = "PIN",
    },
    ref,
  ) {
    const inputs = useRef<Array<HTMLInputElement | null>>([]);

    useImperativeHandle(ref, () => ({
      focus: () => inputs.current[0]?.focus(),
      clear: () => onChange(""),
    }));

    useEffect(() => {
      if (autoFocus) inputs.current[0]?.focus();
    }, [autoFocus]);

    const digits = Array.from({ length }, (_, i) => value[i] ?? "");

    const setDigit = (idx: number, ch: string) => {
      const next = digits.slice();
      next[idx] = ch;
      const newValue = next.join("");
      onChange(newValue);
      if (newValue.length === length && !newValue.includes("") && onComplete) {
        onComplete(newValue);
      }
    };

    const handleChange = (idx: number, raw: string) => {
      const ch = raw.replace(/\D/g, "").slice(-1);
      if (!ch) return;
      setDigit(idx, ch);
      const nextEl = inputs.current[idx + 1];
      if (nextEl) nextEl.focus();
    };

    const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        if (digits[idx]) {
          setDigit(idx, "");
        } else if (idx > 0) {
          setDigit(idx - 1, "");
          inputs.current[idx - 1]?.focus();
        }
      } else if (e.key === "ArrowLeft" && idx > 0) {
        e.preventDefault();
        inputs.current[idx - 1]?.focus();
      } else if (e.key === "ArrowRight" && idx < length - 1) {
        e.preventDefault();
        inputs.current[idx + 1]?.focus();
      }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text").replace(/\D/g, "");
      if (!text) return;
      e.preventDefault();
      const newValue = text.slice(0, length);
      onChange(newValue);
      const focusIdx = Math.min(newValue.length, length - 1);
      inputs.current[focusIdx]?.focus();
      if (newValue.length === length && onComplete) onComplete(newValue);
    };

    return (
      <div
        className={cn("flex items-center justify-center gap-2", className)}
        aria-label={ariaLabel}
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (inputs.current[i] = el)}
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={d}
            disabled={disabled}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              "h-14 w-12 rounded-lg border border-surface-700 bg-surface-900 text-center text-2xl font-bold text-white",
              "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />
        ))}
      </div>
    );
  },
);
