import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { PinPad } from './PinPad';

interface VerifyPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: (pin: string) => Promise<boolean>;
  title?: string;
  description?: string;
}

export function VerifyPinDialog({
  open,
  onOpenChange,
  onVerify,
  title = 'Enter PIN',
  description = 'Enter your 4-digit PIN to continue',
}: VerifyPinDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleComplete = async (pin: string) => {
    setLoading(true);
    setError(null);
    try {
      const success = await onVerify(pin);
      if (!success) {
        setError('Incorrect PIN');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Incorrect PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-6">
          <PinPad
            onComplete={handleComplete}
            error={error}
            disabled={loading}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
