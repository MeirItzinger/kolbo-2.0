import { Outlet } from "react-router-dom";

export default function ChannelAdminLayout() {
  return (
    <div className="admin-theme min-h-screen bg-surface-950">
      <Outlet />
    </div>
  );
}
