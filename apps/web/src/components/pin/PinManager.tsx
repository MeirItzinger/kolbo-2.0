import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PinInput } from "./PinInput";

export interface PinManagerProps {
  title: string;
  description: string;
  /** Returns whether a PIN is currently set. */
  fetchStatus: () => Promise<{ isSet: boolean }>;
  /** Cache key for the status query. */
  statusKey: readonly unknown[];
  setPin: (input: { pin: string; currentPin?: string }) => Promise<void>;
  clearPin: (currentPin: string) => Promise<void>;
}

type Mode = "idle" | "setting" | "changing" | "clearing";

export function PinManager(props: PinManagerProps) {
  const qc = useQueryClient();
  const statusQuery = useQuery({
    queryKey: props.statusKey,
    queryFn: props.fetchStatus,
  });
  const isSet = !!statusQuery.data?.isSet;

  const [mode, setMode] = useState<Mode>("idle");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function reset(next: Mode = "idle") {
    setMode(next);
    setCurrentPin("");
    setNewPin("");
    setConfirm("");
  }

  const setMutation = useMutation({
    mutationFn: (input: { pin: string; currentPin?: string }) =>
      props.setPin(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: props.statusKey });
      setSavedAt(Date.now());
      reset();
    },
  });

  const clearMutation = useMutation({
    mutationFn: (currentPinValue: string) => props.clearPin(currentPinValue),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: props.statusKey });
      setSavedAt(Date.now());
      reset();
    },
  });

  const submitting = setMutation.isPending || clearMutation.isPending;
  const error =
    (setMutation.error as any)?.response?.data?.message ??
    (clearMutation.error as any)?.response?.data?.message ??
    null;

  const canSubmitNew = newPin.length === 4 && newPin === confirm;
  const requiresCurrent = mode === "changing" || mode === "clearing";
  const currentReady = !requiresCurrent || currentPin.length === 4;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary-400" />
          {props.title}
        </CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {savedAt && Date.now() - savedAt < 3000 && (
          <p className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </p>
        )}

        {mode === "idle" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-surface-300">
              Status:{" "}
              <span className={isSet ? "text-emerald-400" : "text-surface-400"}>
                {isSet ? "PIN is set" : "No PIN set"}
              </span>
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setMode(isSet ? "changing" : "setting")}>
                {isSet ? "Change PIN" : "Set PIN"}
              </Button>
              {isSet && (
                <Button
                  variant="outline"
                  onClick={() => setMode("clearing")}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              )}
            </div>
          </div>
        )}

        {mode !== "idle" && (
          <div className="space-y-4 rounded-lg border border-surface-800 bg-surface-900/50 p-4">
            {requiresCurrent && (
              <div>
                <p className="mb-2 text-sm text-surface-300">Current PIN</p>
                <PinInput value={currentPin} onChange={setCurrentPin} />
              </div>
            )}

            {mode !== "clearing" && (
              <>
                <div>
                  <p className="mb-2 text-sm text-surface-300">New PIN</p>
                  <PinInput value={newPin} onChange={setNewPin} />
                </div>
                <div>
                  <p className="mb-2 text-sm text-surface-300">Confirm new PIN</p>
                  <PinInput value={confirm} onChange={setConfirm} />
                </div>
                {newPin && confirm && newPin !== confirm && (
                  <p className="text-sm text-red-400">PINs don't match.</p>
                )}
              </>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => reset()}>
                Cancel
              </Button>
              {mode === "clearing" ? (
                <Button
                  variant="destructive"
                  disabled={submitting || currentPin.length !== 4}
                  onClick={() => clearMutation.mutate(currentPin)}
                >
                  Remove PIN
                </Button>
              ) : (
                <Button
                  disabled={submitting || !canSubmitNew || !currentReady}
                  onClick={() =>
                    setMutation.mutate({
                      pin: newPin,
                      ...(requiresCurrent ? { currentPin } : {}),
                    })
                  }
                >
                  {mode === "setting" ? "Set PIN" : "Update PIN"}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
