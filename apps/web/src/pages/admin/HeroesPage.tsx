import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Pencil,
  Trash2,
  ImageIcon,
  AlertTriangle,
} from "lucide-react";
import {
  adminListHeroes,
  adminCreateHero,
  adminUpdateHero,
  adminDeleteHero,
  adminListChannels,
} from "@/api/admin";
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
import type { LandingHero } from "@/types";

const heroSchema = z.object({
  channelId: z.string().min(1, "Channel is required"),
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  ctaText: z.string().optional(),
  ctaLink: z.string().optional(),
  sortOrder: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

type HeroFormData = z.infer<typeof heroSchema>;

export default function AdminHeroesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LandingHero | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LandingHero | null>(null);

  const heroesQuery = useQuery({
    queryKey: ["admin", "heroes"],
    queryFn: () => adminListHeroes(),
  });

  const channelsQuery = useQuery({
    queryKey: ["admin", "channels", "list"],
    queryFn: () => adminListChannels({ perPage: 100 }),
  });

  const heroes = heroesQuery.data ?? [];
  const channels = channelsQuery.data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: adminDeleteHero,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "heroes"] });
      setDeleteTarget(null);
    },
  });

  const channelName = (id: string) =>
    channels.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Landing Heroes</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" />
          Create Hero
        </Button>
      </div>

      {heroesQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : heroes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="text-lg font-medium text-white">No heroes yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {heroes.map((hero) => (
            <Card key={hero.id}>
              <div className="relative aspect-[21/9] overflow-hidden rounded-t-xl bg-surface-800">
                {hero.imageUrl ? (
                  <img src={hero.imageUrl} alt={hero.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-900/30 to-surface-900">
                    <ImageIcon className="h-10 w-10 text-surface-600" />
                  </div>
                )}
                <div className="absolute left-2 top-2 flex gap-1">
                  <Badge variant={hero.isActive ? "success" : "secondary"}>
                    {hero.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="secondary">#{hero.sortOrder}</Badge>
                </div>
              </div>
              <CardContent className="p-4">
                <p className="font-medium text-white">{hero.title}</p>
                {hero.subtitle && (
                  <p className="mt-1 text-sm text-surface-400">{hero.subtitle}</p>
                )}
                <p className="mt-1 text-xs text-surface-500">
                  {channelName(hero.channelId)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(hero); setShowForm(true); }}>
                    <Pencil className="h-4 w-4" />Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(hero)}>
                    <Trash2 className="h-4 w-4 text-destructive" />Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <HeroFormDialog
          channels={channels}
          hero={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />Delete Hero
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-surface-300">
                Delete <strong className="text-white">{deleteTarget.title}</strong>?
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
    </div>
  );
}

function HeroFormDialog({
  channels,
  hero,
  onClose,
}: {
  channels: { id: string; name: string }[];
  hero: LandingHero | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!hero;

  const { register, handleSubmit, formState: { errors } } = useForm<HeroFormData>({
    resolver: zodResolver(heroSchema),
    defaultValues: hero
      ? {
          channelId: hero.channelId,
          title: hero.title,
          subtitle: hero.subtitle ?? "",
          imageUrl: hero.imageUrl ?? "",
          ctaText: hero.ctaText ?? "",
          ctaLink: hero.ctaLink ?? "",
          sortOrder: hero.sortOrder,
          isActive: hero.isActive,
        }
      : { isActive: true, sortOrder: 0 },
  });

  const createMutation = useMutation({
    mutationFn: adminCreateHero,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "heroes"] }); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: HeroFormData) => adminUpdateHero(hero!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "heroes"] }); onClose(); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: HeroFormData) => {
    if (isEdit) updateMutation.mutate(data);
    else createMutation.mutate(data as any);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{isEdit ? "Edit" : "Create"} Hero</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Channel</label>
              <select {...register("channelId")} className="flex h-10 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Select channel</option>
                {channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
              </select>
              {errors.channelId && <p className="mt-1 text-xs text-destructive">{errors.channelId.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Title</label>
              <Input {...register("title")} placeholder="Hero title" />
              {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Subtitle</label>
              <Input {...register("subtitle")} placeholder="Optional subtitle" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Image URL</label>
              <Input {...register("imageUrl")} placeholder="https://..." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-300">CTA Text</label>
                <Input {...register("ctaText")} placeholder="Watch Now" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-300">CTA Link</label>
                <Input {...register("ctaLink")} placeholder="/videos/..." />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-300">Sort Order</label>
              <Input type="number" {...register("sortOrder")} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="heroActive" {...register("isActive")} className="h-4 w-4 rounded border-surface-700 bg-surface-900 text-primary-600 focus:ring-primary-500" />
              <label htmlFor="heroActive" className="text-sm text-surface-300">Active</label>
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
