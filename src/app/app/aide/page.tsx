"use client";
import { Guard } from "@/components/app/Guard";
import { HelpPage } from "@/components/help/Help";

export default function Page() {
  return (
    <Guard perm="dashboard.view">
      <HelpPage />
    </Guard>
  );
}
