"use client";
import { Guard } from "@/components/app/Guard";
import { NotificationsPage } from "@/components/notifications/Notifications";

export default function Page() {
  return (
    <Guard perm="notification.view">
      <NotificationsPage />
    </Guard>
  );
}
