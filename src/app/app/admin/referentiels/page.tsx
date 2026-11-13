"use client";
import { Guard } from "@/components/app/Guard";
import { ReferentialsPage } from "@/components/admin/Admin";

export default function Page() {
  return (
    <Guard perm="admin.referentials">
      <ReferentialsPage />
    </Guard>
  );
}
