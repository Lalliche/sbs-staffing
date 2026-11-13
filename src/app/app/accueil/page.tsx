"use client";
import { Dashboard } from "@/components/dashboards/Dashboards";
import { Guard } from "@/components/app/Guard";

export default function Page() {
  return (
    <Guard perm="dashboard.view">
      <Dashboard />
    </Guard>
  );
}
