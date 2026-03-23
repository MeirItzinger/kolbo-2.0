import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminGetCreator } from "@/api/admin";
import { Spinner } from "@/components/ui/Spinner";
import CategoriesInner from "@/pages/admin/CategoriesInner";

export default function CreatorAdminCategoriesPage() {
  const { creatorId } = useParams<{ creatorId: string }>();

  const creatorQuery = useQuery({
    queryKey: ["creator-admin", creatorId, "profile"],
    queryFn: () => adminGetCreator(creatorId!),
    enabled: !!creatorId,
  });

  const channelId = (creatorQuery.data as any)?.channelCreators?.[0]?.channelId;

  if (creatorQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!channelId) {
    return (
      <div className="py-12 text-center text-surface-400">
        This creator is not assigned to a channel yet.
      </div>
    );
  }

  return <CategoriesInner channelId={channelId} />;
}
