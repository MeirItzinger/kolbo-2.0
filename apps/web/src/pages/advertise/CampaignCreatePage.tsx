import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { createCampaign } from "@/api/advertiser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { CampaignBillingSection } from "@/features/advertiser/CampaignBillingSection";

const geoTargetSchema = z.object({
  type: z.enum(["CITY", "ZIP_CODE"]),
  value: z.string().min(1, "Value required"),
});

const schema = z.object({
  name: z.string().min(1, "Campaign name required"),
  totalBudget: z.coerce.number().min(1, "Budget must be at least $1"),
  dailyMaxSpend: z.coerce.number().min(1, "Daily max must be at least $1"),
  targetAgeMin: z.coerce.number().min(0).max(120).optional().or(z.literal("")),
  targetAgeMax: z.coerce.number().min(0).max(120).optional().or(z.literal("")),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface GeoTarget {
  type: "CITY" | "ZIP_CODE";
  value: string;
}

export default function CampaignCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [geoTargets, setGeoTargets] = useState<GeoTarget[]>([]);
  const [geoType, setGeoType] = useState<"CITY" | "ZIP_CODE">("CITY");
  const [geoValue, setGeoValue] = useState("");
  const [billingReady, setBillingReady] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: (campaign) => {
      qc.invalidateQueries({ queryKey: ["advertiser", "campaigns"] });
      navigate(`/advertise/campaigns/${campaign.id}`);
    },
  });

  const addGeoTarget = () => {
    const trimmed = geoValue.trim();
    if (!trimmed) return;
    setGeoTargets((prev) => [...prev, { type: geoType, value: trimmed }]);
    setGeoValue("");
  };

  const removeGeoTarget = (idx: number) => {
    setGeoTargets((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = (data: FormData) => {
    createMutation.mutate({
      name: data.name,
      totalBudget: data.totalBudget,
      dailyMaxSpend: data.dailyMaxSpend,
      targetAgeMin:
        typeof data.targetAgeMin === "number" ? data.targetAgeMin : undefined,
      targetAgeMax:
        typeof data.targetAgeMax === "number" ? data.targetAgeMax : undefined,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
      geoTargets: geoTargets.length > 0 ? geoTargets : undefined,
    });
  };

  const selectClass =
    "flex h-10 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Create Campaign</h1>

      {/* Billing uses Stripe Elements and must NOT be nested inside this form (invalid HTML). */}
      <form
        id="campaign-create-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Campaign Name
              </label>
              <Input
                placeholder="e.g. Spring Sale 2026"
                {...register("name")}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-300">
                  Total Budget ($)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="5000.00"
                  {...register("totalBudget")}
                />
                {errors.totalBudget && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.totalBudget.message}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-300">
                  Daily Max Spend ($)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="100.00"
                  {...register("dailyMaxSpend")}
                />
                {errors.dailyMaxSpend && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.dailyMaxSpend.message}
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-300">
                  Start Date (optional)
                </label>
                <Input type="date" {...register("startDate")} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-300">
                  End Date (optional)
                </label>
                <Input type="date" {...register("endDate")} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Targeting */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Targeting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-300">
                  Min Age
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 18"
                  {...register("targetAgeMin")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-300">
                  Max Age
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 65"
                  {...register("targetAgeMax")}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">
                Geographic Targets
              </label>
              <div className="flex gap-2">
                <select
                  value={geoType}
                  onChange={(e) =>
                    setGeoType(e.target.value as "CITY" | "ZIP_CODE")
                  }
                  className={selectClass + " w-32 shrink-0"}
                >
                  <option value="CITY">City</option>
                  <option value="ZIP_CODE">Zip Code</option>
                </select>
                <Input
                  value={geoValue}
                  onChange={(e) => setGeoValue(e.target.value)}
                  placeholder={
                    geoType === "CITY" ? "e.g. New York" : "e.g. 10001"
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGeoTarget();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addGeoTarget}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {geoTargets.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {geoTargets.map((gt, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      <span className="text-xs text-surface-500">
                        {gt.type === "CITY" ? "City" : "Zip"}:
                      </span>{" "}
                      {gt.value}
                      <button
                        type="button"
                        onClick={() => removeGeoTarget(idx)}
                        className="ml-1 rounded-full p-0.5 hover:bg-surface-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </form>

      <CampaignBillingSection onReadyChange={setBillingReady} />

      {/* Note about video upload (outside campaign form — no inputs) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Video Ad</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-surface-400">
            You can upload your video ad after creating the campaign. Once
            created, you'll be taken to the campaign page where you can upload
            your creative and submit for review.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/advertise/dashboard")}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="campaign-create-form"
          disabled={createMutation.isPending || !billingReady}
        >
          {createMutation.isPending ? (
            <Spinner size="sm" />
          ) : (
            "Create Campaign"
          )}
        </Button>
      </div>

      {createMutation.isError && (
        <p className="text-sm text-destructive">
          {(createMutation.error as any)?.response?.data?.message ??
            "Failed to create campaign"}
        </p>
      )}
    </div>
  );
}
