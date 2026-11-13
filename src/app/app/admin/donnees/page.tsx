"use client";
import { Guard } from "@/components/app/Guard";
import { DataPage } from "@/components/admin/Admin";

export default function Page() {
  return (
    <Guard perm="admin.data">
      <DataPage />
    </Guard>
  );
}
