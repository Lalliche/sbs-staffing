"use client";
import { Guard } from "@/components/app/Guard";
import { AdminHub } from "@/components/admin/Admin";

export default function Page() {
  return (
    <Guard perm="admin.view">
      <AdminHub />
    </Guard>
  );
}
