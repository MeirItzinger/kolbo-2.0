import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Megaphone } from "lucide-react";
import { useAdvertiserAuth } from "@/hooks/useAdvertiserAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

const schema = z
  .object({
    companyName: z.string().min(1, "Company name required"),
    contactName: z.string().min(1, "Contact name required"),
    email: z.string().email("Valid email required"),
    phone: z.string().optional(),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function AdvertiserSignupPage() {
  const { signup } = useAdvertiserAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setError("");
      await signup({
        email: data.email,
        password: data.password,
        companyName: data.companyName,
        contactName: data.contactName,
        phone: data.phone,
      });
      navigate("/advertise/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.message ?? "Signup failed. Please try again."
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-600/20">
            <Megaphone className="h-6 w-6 text-amber-400" />
          </div>
          <CardTitle>Create Advertiser Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Company Name
              </label>
              <Input
                placeholder="Acme Corp"
                {...register("companyName")}
              />
              {errors.companyName && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.companyName.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Contact Name
              </label>
              <Input
                placeholder="John Doe"
                {...register("contactName")}
              />
              {errors.contactName && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.contactName.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Email
              </label>
              <Input
                type="email"
                placeholder="you@company.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Phone (optional)
              </label>
              <Input placeholder="555-123-4567" {...register("phone")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Password
              </label>
              <Input
                type="password"
                placeholder="Min 8 characters"
                {...register("password")}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Confirm Password
              </label>
              <Input
                type="password"
                placeholder="Repeat password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner size="sm" /> : "Create Account"}
            </Button>
            <p className="text-center text-sm text-surface-400">
              Already have an account?{" "}
              <Link
                to="/advertise/login"
                className="text-primary-400 hover:text-primary-300"
              >
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
