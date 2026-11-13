"use client";
import { Guard } from "@/components/app/Guard";
import { UsersPage } from "@/components/admin/Admin";

export default function Page() {
  return (
    <Guard perm="admin.users">
      <UsersPage />
    </Guard>
  );
}
