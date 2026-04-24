import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PinPrompt } from "@/components/pin/PinPrompt";
import { readGrace, verifyParentalPin } from "@/api/pin";
import { registerParentalGraceRequester } from "@/api/client";

interface PinGateContextValue {
  /**
   * Returns a parental grace token, prompting the user if needed.
   * Resolves to null if the user dismisses the prompt.
   */
  requestParentalGrace: () => Promise<string | null>;
}

const PinGateContext = createContext<PinGateContextValue | null>(null);

type Resolver = (token: string | null) => void;

let externalRequester: (() => Promise<string | null>) | null = null;
export function getParentalGraceRequester() {
  return externalRequester;
}

export function PinGateProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const resolversRef = useRef<Resolver[]>([]);

  const requestParentalGrace = useCallback(async (): Promise<string | null> => {
    const cached = readGrace("parental");
    if (cached) return cached;
    return new Promise<string | null>((resolve) => {
      resolversRef.current.push(resolve);
      setOpen(true);
    });
  }, []);

  useEffect(() => {
    externalRequester = requestParentalGrace;
    registerParentalGraceRequester(requestParentalGrace);
    return () => {
      externalRequester = null;
      registerParentalGraceRequester(null);
    };
  }, [requestParentalGrace]);

  const resolveAll = (token: string | null) => {
    const rs = resolversRef.current;
    resolversRef.current = [];
    rs.forEach((r) => r(token));
  };

  return (
    <PinGateContext.Provider value={{ requestParentalGrace }}>
      {children}
      <PinPrompt
        open={open}
        title="Enter parental PIN"
        description="Confirm your PIN to authorize this purchase."
        onClose={() => {
          setOpen(false);
          resolveAll(null);
        }}
        onVerify={async (pin) => {
          const token = await verifyParentalPin(pin);
          setOpen(false);
          resolveAll(token);
          return true;
        }}
      />
    </PinGateContext.Provider>
  );
}

export function usePinGate(): PinGateContextValue {
  const ctx = useContext(PinGateContext);
  if (!ctx) throw new Error("usePinGate must be used within PinGateProvider");
  return ctx;
}
