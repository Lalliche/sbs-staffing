"use client";
import { Guard } from "@/components/app/Guard";
import { PlanningGrid } from "@/components/planning/PlanningGrid";

export default function Page() {
  return (
    <Guard perm="planning.view">
      <PlanningGrid />
    </Guard>
  );
}
