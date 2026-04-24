import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, KeyRound } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PinInput } from "@/components/pin/PinInput";
import { confirmParentalPinReset } from "@/api/pin";

export default function PinResetPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () => confirmParentalPinReset(token, pin),
    onSuccess: () => setDone(true),
  });

  const errorMsg =
    (mutation.error as any)?.response?.data?.message ??
    (mutation.error ? "Couldn't reset your PIN." : null);

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Invalid link</CardTitle>
            <CardDescription>
              This reset link is missing a token. Open the link from your email
              again, or request a new one from your security settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/account/security">Go to security</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-base font-medium text-white">
              Your parental PIN was reset.
            </p>
            <p className="text-sm text-surface-400">
              You can now use your new PIN to manage parental controls and
              authorize purchases.
            </p>
            <Button asChild>
              <Link to="/account/security">Back to security</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canSubmit = pin.length === 4 && pin === confirm && !mutation.isPending;

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary-400" />
            Reset your parental PIN
          </CardTitle>
          <CardDescription>
            Choose a new 4-digit PIN. The reset link is valid for 1 hour.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-surface-300">New PIN</p>
            <PinInput value={pin} onChange={setPin} autoFocus />
          </div>
          <div>
            <p className="mb-2 text-sm text-surface-300">Confirm new PIN</p>
            <PinInput value={confirm} onChange={setConfirm} />
          </div>
          {pin && confirm && pin !== confirm && (
            <p className="text-sm text-red-400">PINs don't match.</p>
          )}
          {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
          <Button
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
            className="w-full"
          >
            {mutation.isPending ? "Saving…" : "Set new PIN"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
