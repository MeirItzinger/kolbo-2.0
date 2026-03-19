import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Monitor, Smartphone, Tablet, Globe, ChevronLeft } from "lucide-react";
import { getDevices } from "@/api/account";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatDate } from "@/lib/utils";
import type { Device } from "@/types";

function deviceIcon(os: string) {
  const lower = os.toLowerCase();
  if (lower.includes("ios") || lower.includes("android"))
    return Smartphone;
  if (lower.includes("ipad") || lower.includes("tablet"))
    return Tablet;
  if (lower.includes("windows") || lower.includes("mac") || lower.includes("linux"))
    return Monitor;
  return Globe;
}

export default function DevicesPage() {
  const devicesQuery = useQuery({
    queryKey: ["account", "devices"],
    queryFn: getDevices,
  });

  const devices = devicesQuery.data ?? [];

  if (devicesQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/account">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-white">Devices</h1>
      </div>

      {devices.length > 0 ? (
        <div className="space-y-3">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Monitor className="mx-auto mb-4 h-12 w-12 text-surface-600" />
            <p className="text-lg font-medium text-white">No devices found</p>
            <p className="mt-1 text-surface-400">
              Devices will appear here once you start streaming.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DeviceCard({ device }: { device: Device }) {
  const Icon = deviceIcon(device.os);

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-800">
            <Icon className="h-6 w-6 text-surface-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-white">{device.name}</p>
              {device.isCurrent && <Badge variant="success">Current</Badge>}
            </div>
            <p className="text-sm text-surface-400">
              {device.browser} &middot; {device.os}
            </p>
            <p className="text-xs text-surface-500">
              Last seen {formatDate(device.lastActiveAt)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
