import { useState, useRef, useEffect, type KeyboardEvent } from 'react';

interface PinPadProps {
  onComplete: (pin: string) => void;
  error?: string | null;
  disabled?: boolean;
  length?: number;
}

export function PinPad({ onComplete, error, disabled = false, length = 4 }: PinPadProps) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (error) {
      setShake(true);
      setDigits(Array(length).fill(''));
      setTimeout(() => {
        setShake(false);
        inputRefs.current[0]?.focus();
      }, 500);
    }
  }, [error, length]);

  const handleChange = (index: number, value: string) => {
    if (disabled) return;
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newDigits.every(d => d !== '') && newDigits.join('').length === length) {
      onComplete(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted.length === length) {
      const newDigits = pasted.split('');
      setDigits(newDigits);
      onComplete(pasted);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`flex gap-3 ${shake ? 'animate-shake' : ''}`}
        onPaste={handlePaste}
      >
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className="h-16 w-14 rounded-xl border-2 border-surface-700 bg-surface-800 text-center text-2xl font-bold text-white outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 disabled:opacity-50"
          />
        ))}
      </div>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
