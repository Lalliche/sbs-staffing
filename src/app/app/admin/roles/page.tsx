"use client";
import { Guard } from "@/components/app/Guard";
import { RolesPage } from "@/components/admin/Admin";

export default function Page() {
  return (
    <Guard perm="admin.roles">
      <RolesPage />
    </Guard>
  );
}
