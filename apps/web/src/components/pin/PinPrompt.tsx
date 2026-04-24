import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { PinInput, type PinInputHandle } from "./PinInput";

export interface PinPromptProps {
  open: boolean;
  title?: string;
  description?: string;
  /** Returns true on success, false on failure (component will surface the error). */
  onVerify: (pin: string) => Promise<boolean | void>;
  onClose: () => void;
  errorMessage?: string | null;
  /** Footer slot for "Forgot PIN?" link, etc. */
  footer?: React.ReactNode;
}

export function PinPrompt({
  open,
  title = "Enter PIN",
  description = "Enter your 4-digit PIN to continue.",
  onVerify,
  onClose,
  errorMessage,
  footer,
}: PinPromptProps) {
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<PinInputHandle>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setLocalError(null);
      const id = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const submit = async (value: string) => {
    if (value.length !== 4) return;
    setSubmitting(true);
    setLocalError(null);
    try {
      const ok = await onVerify(value);
      if (ok === false) {
        setLocalError("Incorrect PIN. Please try again.");
        setPin("");
        inputRef.current?.focus();
      }
    } catch (err) {
      const message =
        (err as any)?.response?.data?.message ?? "Couldn't verify PIN.";
      setLocalError(message);
      setPin("");
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const error = errorMessage ?? localError;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600/15">
            <Lock className="h-6 w-6 text-primary-400" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <PinInput
            ref={inputRef}
            value={pin}
            onChange={setPin}
            onComplete={submit}
            disabled={submitting}
            autoFocus
          />
          {error && (
            <p className="text-center text-sm text-red-400">{error}</p>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 pt-1">
          <Button
            onClick={() => submit(pin)}
            disabled={submitting || pin.length !== 4}
            className="w-full"
          >
            {submitting ? "Verifying…" : "Continue"}
          </Button>
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}
