import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, CreditCard, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import {
  adminListPlans,
  adminCreatePlan,
  adminUpdatePlan,
  adminDeletePlan,
  adminBulkDeletePlans,
  adminListChannels,
  adminGetChannel,
} from "@/api/admin";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import type { SubscriptionPlan, PlanPriceVariant } from "@/types";

const variantSchema = z.object({
  id: z.string().optional(),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]),
  concurrencyTier: z.enum(["STREAMS_1", "STREAMS_3", "STREAMS_5"]),
  adTier: z.enum(["WITH_ADS", "WITHOUT_ADS"]),
  price: z.coerce.number().min(0, "Price required"),
  currency: z.string().default("usd"),
  isActive: z.boolean().default(true),
});

const planSchema = z.object({
  channelId: z.string().min(1, "Channel is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  variants: z.array(variantSchema).min(1, "Add at least one price variant"),
});

type PlanFormData = z.infer<typeof planSchema>;

function variantLabel(v: PlanPriceVariant) {
  const interval = v.billingInterval === "YEARLY" ? "Yearly" : "Monthly";
  const streams = v.concurrencyTier.replace("STREAMS_", "");
  const ads = v.adTier === "WITH_ADS" ? " · Ads" : "";
  return `${interval} · ${streams} streams${ads}`;
}

export default function AdminPlansPage() {
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const channelAdminChannelId = !isSuperAdmin
    ? user?.roles.find((r) => r.role?.key === "CHANNEL_ADMIN" && r.channelId)?.channelId ?? ""
    : "";

  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["admin", "plans", channelAdminChannelId],
    queryFn: () => adminListPlans(channelAdminChannelId ? { channelId: channelAdminChannelId } : undefined),
  });

  const channelsQuery = useQuery({
    queryKey: ["admin", "channels", "list"],
    queryFn: () => adminListChannels({ perPage: 100 }),
    enabled: isSuperAdmin,
  });

  const channelDetailQuery = useQuery({
    queryKey: ["admin", "channel", channelAdminChannelId],
    queryFn: () => adminGetChannel(channelAdminChannelId),
    enabled: !!channelAdminChannelId,
  });

  const plans = plansQuery.data ?? [];
  const channels = isSuperAdmin
    ? (channelsQuery.data?.data ?? [])
    : channelDetailQuery.data
      ? [{ id: channelDetailQuery.data.id, name: channelDetailQuery.data.name }]
      : [];

  const deleteMutation = useMutation({
    mutationFn: adminDeletePlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      setDeleteTarget(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: adminBulkDeletePlans,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      setSelected(new Set());
      setShowBulkConfirm(false);
    },
  });

  const channelName = (id: string) =>
    channels.find((c) => c.id === id)?.name ?? id;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = plans.length > 0 && selected.size === plans.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(plans.map((p) => p.id)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Subscription Plans</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" />
          Create Plan
        </Button>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary-500/30 bg-primary-600/10 px-4 py-3">
          <span className="text-sm font-medium text-white">
            {selected.size} plan{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowBulkConfirm(true)}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {plansQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="text-lg font-medium text-white">No plans yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Select all */}
          <div className="flex items-center gap-3 px-1">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-xs text-surface-400">Select all</span>
          </div>

          {plans.map((plan) => {
            const variants = plan.priceVariants ?? [];
            const isExpanded = expandedPlan === plan.id;
            const isChecked = selected.has(plan.id);
            return (
              <Card key={plan.id}>
                <div
                  className="flex cursor-pointer items-center justify-between px-5 py-4"
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(plan.id)}
                      className="h-4 w-4 shrink-0 rounded border-surface-600 bg-surface-800 text-primary-600 focus:ring-primary-500"
                    />
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-surface-400" /> : <ChevronRight className="h-4 w-4 text-surface-400" />}
                    <div>
                      <h3 className="font-semibold text-white">{plan.name}</h3>
                      <p className="text-sm text-surface-400">{channelName(plan.channelId)} · {variants.length} variant{variants.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={plan.isActive ? "success" : "secondary"}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditing(plan); setShowForm(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(plan); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {isExpanded && variants.length > 0 && (
                  <div className="border-t border-surface-800 px-5 pb-4 pt-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-surface-500">
                          <th className="pb-2 pr-4">Interval</th>
                          <th className="pb-2 pr-4">Streams</th>
                          <th className="pb-2 pr-4">Ads</th>
                          <th className="pb-2 pr-4">Price</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-800/50">
                        {variants.map((v) => (
                          <tr key={v.id}>
                            <td className="py-2 pr-4 text-surface-300">
                              <Badge variant="outline">{v.billingInterval === "YEARLY" ? "Yearly" : "Monthly"}</Badge>
                            </td>
                            <td className="py-2 pr-4 text-surface-300">{v.concurrencyTier.replace("STREAMS_", "")}</td>
                            <td className="py-2 pr-4">
                              <Badge variant={v.adTier === "WITH_ADS" ? "warning" : "secondary"}>
                                {v.adTier === "WITH_ADS" ? "Ads" : "No Ads"}
                              </Badge>
                            </td>
                            <td className="py-2 pr-4 font-medium text-white">
                              {formatCurrency(Number(v.price))}/{v.billingInterval === "YEARLY" ? "yr" : "mo"}
                            </td>
                            <td className="py-2">
                              <Badge variant={v.isActive ? "success" : "secondary"}>
                                {v.isActive ? "Active" : "Off"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <PlanFormDialog
          channels={channels}
          plan={editing}
          lockedChannelId={channelAdminChannelId || undefined}
          channelName={channelDetailQuery.data?.name}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Single delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />Delete Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-surface-300">
                Delete <strong className="text-white">{deleteTarget.name}</strong>? Active subscribers will be affected.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteTarget.id)}>
                  {deleteMutation.isPending ? <Spinner size="sm" /> : "Delete"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk delete confirm */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />Delete {selected.size} Plan{selected.size !== 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-surface-300">
                This will permanently delete <strong className="text-white">{selected.size} plan{selected.size !== 1 ? "s" : ""}</strong> and all their price variants. Active subscribers will be affected.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowBulkConfirm(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={bulkDeleteMutation.isPending}
                  onClick={() => bulkDeleteMutation.mutate([...selected])}
                >
                  {bulkDeleteMutation.isPending ? <Spinner size="sm" /> : `Delete ${selected.size} Plan${selected.size !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function PlanFormDialog({
  channels,
  plan,
  lockedChannelId,
  channelName,
  onClose,
}: {
  channels: { id: string; name: string }[];
  plan: SubscriptionPlan | null;
  lockedChannelId?: string;
  channelName?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!plan;

  const { register, control, handleSubmit, formState: { errors } } = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: plan
      ? {
          channelId: plan.channelId,
          name: plan.name,
          description: plan.description ?? "",
          isActive: plan.isActive,
          variants: (plan.priceVariants ?? []).map((v) => ({
            id: v.id,
            billingInterval: v.billingInterval ?? "MONTHLY",
            concurrencyTier: v.concurrencyTier ?? "STREAMS_3",
            adTier: v.adTier ?? "WITHOUT_ADS",
            price: Number(v.price),
            currency: v.currency ?? "usd",
            isActive: v.isActive,
          })),
        }
      : {
          channelId: lockedChannelId ?? "",
          isActive: true,
          variants: [
            { billingInterval: "MONTHLY", concurrencyTier: "STREAMS_3", adTier: "WITHOUT_ADS", price: 0, currency: "usd", isActive: true },
          ],
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "variants" });

  const createMutation = useMutation({
    mutationFn: adminCreatePlan,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "plans"] }); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: PlanFormData) => adminUpdatePlan(plan!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "plans"] }); onClose(); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: PlanFormData) => {
    if (isEdit) updateMutation.mutate(data);
    else createMutation.mutate(data as any);
  };

  const selectClass = "flex h-10 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 py-8 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{isEdit ? "Edit" : "Create"} Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-300">Channel</label>
                {lockedChannelId ? (
                  <>
                    <input type="hidden" {...register("channelId")} />
                    <div className="flex h-10 w-full items-center rounded-md border border-surface-700 bg-surface-800 px-3 text-sm text-surface-300">
                      {channelName ?? "Loading..."}
                    </div>
                  </>
                ) : (
                  <select {...register("channelId")} className={selectClass}>
                    <option value="">Select channel</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>{ch.name}</option>
                    ))}
                  </select>
                )}
                {errors.channelId && <p className="mt-1 text-xs text-destructive">{errors.channelId.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-300">Plan Name</label>
                <Input {...register("name")} placeholder="e.g. MyMaor Basic" />
                {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Description</label>
              <Input {...register("description")} placeholder="Optional description" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="planActive" {...register("isActive")} className="h-4 w-4 rounded border-surface-700 bg-surface-900 text-primary-600 focus:ring-primary-500" />
              <label htmlFor="planActive" className="text-sm text-surface-300">Active</label>
            </div>

            {/* Price variants */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Price Variants</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ billingInterval: "MONTHLY", concurrencyTier: "STREAMS_3", adTier: "WITHOUT_ADS", price: 0, currency: "usd", isActive: true })}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Variant
                </Button>
              </div>
              {errors.variants?.message && (
                <p className="mb-2 text-xs text-destructive">{errors.variants.message}</p>
              )}
              <div className="space-y-3">
                {fields.map((field, idx) => (
                  <div key={field.id} className="rounded-lg border border-surface-700 bg-surface-800/50 p-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-xs text-surface-400">Interval</label>
                        <select {...register(`variants.${idx}.billingInterval`)} className={selectClass}>
                          <option value="MONTHLY">Monthly</option>
                          <option value="YEARLY">Yearly</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-surface-400">Streams</label>
                        <select {...register(`variants.${idx}.concurrencyTier`)} className={selectClass}>
                          <option value="STREAMS_1">1 Stream</option>
                          <option value="STREAMS_3">3 Streams</option>
                          <option value="STREAMS_5">5 Streams</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-surface-400">Ads</label>
                        <select {...register(`variants.${idx}.adTier`)} className={selectClass}>
                          <option value="WITHOUT_ADS">No Ads</option>
                          <option value="WITH_ADS">With Ads</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-surface-400">Price</label>
                        <div className="flex gap-2">
                          <Input type="number" step="0.01" {...register(`variants.${idx}.price`)} className="flex-1" />
                          {fields.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} className="shrink-0">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                        {errors.variants?.[idx]?.price && (
                          <p className="mt-1 text-xs text-destructive">{errors.variants[idx]?.price?.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner size="sm" /> : isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
