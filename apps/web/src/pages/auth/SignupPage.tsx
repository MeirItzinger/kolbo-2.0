import { useState, createContext, useContext, useCallback } from "react";
import type { ReactNode } from "react";
import type { Channel, SubscriptionPlan, PlanPriceVariant, Bundle } from "@/types";
import { CreateAccount } from "@/pages/signup/CreateAccount";
import { ChannelSelection } from "@/pages/signup/ChannelSelection";
import { Review } from "@/pages/signup/Review";

// ── Signup state ────────────────────────────────────────────────────

export interface AccountData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface SelectedPlan {
  channel: Channel;
  plan: SubscriptionPlan;
  variant: PlanPriceVariant;
}

export interface SelectedBundle {
  bundle: Bundle;
  channel: Channel;
}

export interface SignupState {
  account: AccountData | null;
  selectedPlans: SelectedPlan[];
  selectedBundles: SelectedBundle[];
}

interface SignupContextValue {
  state: SignupState;
  setAccount: (data: AccountData) => void;
  selectPlan: (channel: Channel, plan: SubscriptionPlan, variant: PlanPriceVariant) => void;
  deselectChannel: (channelId: string) => void;
  toggleBundle: (bundle: Bundle, channel: Channel) => void;
  removePlan: (planId: string) => void;
  removeBundle: (bundleId: string) => void;
  step: number;
  goTo: (step: number) => void;
  next: () => void;
  prev: () => void;
}

const SignupContext = createContext<SignupContextValue | null>(null);

export function useSignup() {
  const ctx = useContext(SignupContext);
  if (!ctx) throw new Error("useSignup must be used within SignupPage");
  return ctx;
}

function SignupProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<SignupState>({
    account: null,
    selectedPlans: [],
    selectedBundles: [],
  });

  const setAccount = useCallback((data: AccountData) => {
    setState((s) => ({ ...s, account: data }));
  }, []);

  const selectPlan = useCallback(
    (channel: Channel, plan: SubscriptionPlan, variant: PlanPriceVariant) => {
      setState((s) => {
        const withoutChannel = s.selectedPlans.filter(
          (sp) => sp.channel.id !== channel.id,
        );
        return {
          ...s,
          selectedPlans: [...withoutChannel, { channel, plan, variant }],
        };
      });
    },
    [],
  );

  const deselectChannel = useCallback((channelId: string) => {
    setState((s) => ({
      ...s,
      selectedPlans: s.selectedPlans.filter(
        (sp) => sp.channel.id !== channelId,
      ),
    }));
  }, []);

  const toggleBundle = useCallback((bundle: Bundle, channel: Channel) => {
    setState((s) => {
      const exists = s.selectedBundles.some((sb) => sb.bundle.id === bundle.id);
      if (exists) {
        return {
          ...s,
          selectedBundles: s.selectedBundles.filter(
            (sb) => sb.bundle.id !== bundle.id,
          ),
        };
      }
      return {
        ...s,
        selectedBundles: [...s.selectedBundles, { bundle, channel }],
      };
    });
  }, []);

  const removePlan = useCallback((planId: string) => {
    setState((s) => ({
      ...s,
      selectedPlans: s.selectedPlans.filter((sp) => sp.plan.id !== planId),
    }));
  }, []);

  const removeBundle = useCallback((bundleId: string) => {
    setState((s) => ({
      ...s,
      selectedBundles: s.selectedBundles.filter(
        (sb) => sb.bundle.id !== bundleId,
      ),
    }));
  }, []);

  const goTo = useCallback((s: number) => setStep(s), []);
  const next = useCallback(() => setStep((s) => Math.min(s + 1, 2)), []);
  const prev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  return (
    <SignupContext.Provider
      value={{
        state,
        setAccount,
        selectPlan,
        deselectChannel,
        toggleBundle,
        removePlan,
        removeBundle,
        step,
        goTo,
        next,
        prev,
      }}
    >
      {children}
    </SignupContext.Provider>
  );
}

// ── Step indicator ──────────────────────────────────────────────────

const steps = ["Account", "Channels", "Review"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                i <= current
                  ? "bg-primary-600 text-white"
                  : "bg-surface-800 text-surface-500"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`hidden text-sm font-medium sm:inline ${
                i <= current ? "text-white" : "text-surface-500"
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-px w-8 sm:w-12 ${
                i < current ? "bg-primary-600" : "bg-surface-700"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

function SignupContent() {
  const { step } = useSignup();

  return (
    <div className="w-full max-w-5xl">
      <StepIndicator current={step} />
      {step === 0 && <CreateAccount />}
      {step === 1 && <ChannelSelection />}
      {step === 2 && <Review />}
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center px-4 py-8">
      <SignupProvider>
        <SignupContent />
      </SignupProvider>
    </div>
  );
}
