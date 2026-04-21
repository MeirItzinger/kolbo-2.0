import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Shield, CheckCircle2, Lock, ShoppingCart } from "lucide-react";
import * as authApi from "@/api/auth";
import { getAccountSettings, updateAccountSettings, setParentalPin, clearParentalPin } from "@/api/account";
import { getProfiles, setProfilePin, clearProfilePin } from "@/api/profiles";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { SetPinDialog } from "@/components/pin";
import { ProfileAvatar } from "@/components/profiles";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function SecurityPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [parentalPinOpen, setParentalPinOpen] = useState(false);
  const [profilePinId, setProfilePinId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["account", "settings"],
    queryFn: getAccountSettings,
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: getProfiles,
  });

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

  const purchasePinMutation = useMutation({
    mutationFn: (enabled: boolean) => updateAccountSettings({ requirePinForPurchases: enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["account", "settings"] }),
  });

  const clearParentalPinMutation = useMutation({
    mutationFn: clearParentalPin,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["account", "settings"] }),
  });

  const settings = settingsQuery.data;
  const profiles = profilesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-2xl font-bold text-white">Security</h1>

      <div className="space-y-6">
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
                  {mutation.isPending ? "Updating..." : "Update password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary-400" />
              Parental PIN
            </CardTitle>
            <CardDescription>
              Set a household PIN to protect parental controls access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settings?.hasParentalPin ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-white">PIN is set</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setParentalPinOpen(true)}>
                    Change
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearParentalPinMutation.mutate()}
                    disabled={clearParentalPinMutation.isPending}
                    className="text-red-400 hover:text-red-300"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setParentalPinOpen(true)}>
                Set Parental PIN
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary-400" />
              Profile PINs
            </CardTitle>
            <CardDescription>
              Manage PINs for individual profiles
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profiles.length === 0 ? (
              <p className="text-sm text-surface-500">No profiles found</p>
            ) : (
              <div className="space-y-3">
                {profiles.map(profile => (
                  <div key={profile.id} className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-800/50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ProfileAvatar avatarUrl={profile.avatarUrl} name={profile.name} size="sm" />
                      <span className="text-sm text-white">{profile.name}</span>
                    </div>
                    {profile.isLocked ? (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setProfilePinId(profile.id)}>
                          Change
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => clearProfilePin(profile.id).then(() => queryClient.invalidateQueries({ queryKey: ['profiles'] }))}
                          className="text-red-400 hover:text-red-300"
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setProfilePinId(profile.id)}>
                        Set PIN
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary-400" />
              Purchase Protection
            </CardTitle>
            <CardDescription>
              Require PIN for all purchases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white">Require PIN for purchases</p>
                <p className="text-sm text-surface-400">A PIN will be required before completing any purchase</p>
              </div>
              <button
                type="button"
                onClick={() => purchasePinMutation.mutate(!settings?.requirePinForPurchases)}
                disabled={purchasePinMutation.isPending}
                className={`h-6 w-11 rounded-full transition-colors ${settings?.requirePinForPurchases ? 'bg-primary-500' : 'bg-surface-700'}`}
              >
                <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${settings?.requirePinForPurchases ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <SetPinDialog
        open={parentalPinOpen}
        onOpenChange={setParentalPinOpen}
        onSetPin={async (pin) => {
          await setParentalPin(pin);
          queryClient.invalidateQueries({ queryKey: ["account", "settings"] });
        }}
        title="Set Parental PIN"
      />

      <SetPinDialog
        open={!!profilePinId}
        onOpenChange={(open) => { if (!open) setProfilePinId(null); }}
        onSetPin={async (pin) => {
          if (profilePinId) {
            await setProfilePin(profilePinId, pin);
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
          }
        }}
        title="Set Profile PIN"
      />
    </div>
  );
}
