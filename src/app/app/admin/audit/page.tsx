"use client";
import { Guard } from "@/components/app/Guard";
import { AuditPage } from "@/components/admin/Admin";

export default function Page() {
  return (
    <Guard perm="admin.audit">
      <AuditPage />
    </Guard>
  );
}
