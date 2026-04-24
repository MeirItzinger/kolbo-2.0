import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  Shield,
  CheckCircle2,
  Mail,
  User as UserIcon,
} from "lucide-react";
import * as authApi from "@/api/auth";
import {
  clearParentalPin,
  clearProfilePin,
  getParentalPinStatus,
  requestParentalPinReset,
  setParentalPin,
  setProfilePin,
} from "@/api/pin";
import { listProfiles } from "@/api/profiles";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { PinManager } from "@/components/pin/PinManager";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-white">Security</h1>

      <PasswordCard />

      <PinManager
        title="Parental PIN"
        description="Required to change parental controls and authorize protected purchases."
        fetchStatus={getParentalPinStatus}
        statusKey={["pin", "parental", "status"]}
        setPin={setParentalPin}
        clearPin={clearParentalPin}
      />

      <ParentalPinResetCard />

      <ProfilePinsCard />
    </div>
  );
}

function PasswordCard() {
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (vars: FormValues) =>
      authApi.changePassword({
        currentPassword: vars.currentPassword,
        newPassword: vars.newPassword,
      }),
    onSuccess: () => {
      setSuccess(true);
      reset();
      setTimeout(() => setSuccess(false), 4000);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary-400" />
          Change password
        </CardTitle>
        <CardDescription>
          Choose a new password. All other sessions will be signed out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="space-y-4"
        >
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-primary-600/30 bg-primary-600/10 px-4 py-3 text-sm text-primary-300">
              <CheckCircle2 className="h-4 w-4" />
              Password updated.
            </div>
          )}

          {mutation.error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {(mutation.error as any)?.response?.data?.message ??
                "Could not update password."}
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="currentPassword"
              className="text-sm font-medium text-surface-200"
            >
              Current password
            </label>
            <Input
              id="currentPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              {...register("currentPassword")}
            />
            {errors.currentPassword && (
              <p className="text-xs text-destructive">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="newPassword"
              className="text-sm font-medium text-surface-200"
            >
              New password
            </label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="pr-10"
                {...register("newPassword")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-destructive">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-surface-200"
            >
              Confirm new password
            </label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ParentalPinResetCard() {
  const status = useQuery({
    queryKey: ["pin", "parental", "status"],
    queryFn: getParentalPinStatus,
  });
  const [sent, setSent] = useState(false);
  const mutation = useMutation({
    mutationFn: requestParentalPinReset,
    onSuccess: () => setSent(true),
  });

  if (!status.data?.isSet) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary-400" />
          Forgot your parental PIN?
        </CardTitle>
        <CardDescription>
          We'll email you a one-time link to set a new PIN. The link expires in
          1 hour.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sent ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Check your inbox for the reset link.
          </p>
        ) : (
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Sending…" : "Email me a reset link"}
          </Button>
        )}
        {mutation.error && (
          <p className="text-sm text-red-400">
            {(mutation.error as any)?.response?.data?.message ??
              "Couldn't send reset email."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ProfilePinsCard() {
  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: listProfiles,
  });
  const profiles = profilesQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5 text-primary-400" />
          Profile PINs
        </CardTitle>
        <CardDescription>
          Add a PIN to any profile to require it before that profile can be
          selected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {profilesQuery.isLoading ? (
          <p className="text-sm text-surface-400">Loading profiles…</p>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-surface-400">
            You don't have any profiles yet.
          </p>
        ) : (
          profiles.map((p) => (
            <PinManager
              key={p.id}
              title={p.name}
              description={
                p.isKidsProfile
                  ? "Kids profile · pin protects switching into it."
                  : "Standard profile · pin protects switching into it."
              }
              fetchStatus={async () => {
                const { getProfilePinStatus } = await import("@/api/pin");
                return getProfilePinStatus(p.id);
              }}
              statusKey={["pin", "profile", p.id, "status"]}
              setPin={(input) => setProfilePin(p.id, input)}
              clearPin={(currentPin) => clearProfilePin(p.id, currentPin)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
