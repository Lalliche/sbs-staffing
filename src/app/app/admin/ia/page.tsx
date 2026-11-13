"use client";
import { Guard } from "@/components/app/Guard";
import { AiSettingsPage } from "@/components/admin/Admin";

export default function Page() {
  return (
    <Guard perm="ai.settings">
      <AiSettingsPage />
    </Guard>
  );
}
