import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { PinPad } from './PinPad';

interface SetPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetPin: (pin: string) => Promise<void>;
  title?: string;
}

export function SetPinDialog({
  open,
  onOpenChange,
  onSetPin,
  title = 'Set PIN',
}: SetPinDialogProps) {
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep('enter');
    setFirstPin('');
    setError(null);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleFirstPin = (pin: string) => {
    setFirstPin(pin);
    setStep('confirm');
    setError(null);
  };

  const handleConfirmPin = async (pin: string) => {
    if (pin !== firstPin) {
      setError("PINs don't match");
      setStep('enter');
      setFirstPin('');
      return;
    }

    setLoading(true);
    try {
      await onSetPin(pin);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to set PIN');
      setStep('enter');
      setFirstPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {step === 'enter' ? 'Choose a 4-digit PIN' : 'Confirm your PIN'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-6">
          <PinPad
            key={step}
            onComplete={step === 'enter' ? handleFirstPin : handleConfirmPin}
            error={error}
            disabled={loading}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
