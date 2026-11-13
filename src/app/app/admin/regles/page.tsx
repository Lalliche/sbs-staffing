"use client";
import { Guard } from "@/components/app/Guard";
import { RulesPage } from "@/components/admin/Admin";

export default function Page() {
  return (
    <Guard perm="admin.settings">
      <RulesPage />
    </Guard>
  );
}
