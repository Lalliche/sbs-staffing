"use client";
import { Guard } from "@/components/app/Guard";
import { CapacityPage } from "@/components/capacity/Capacity";

export default function Page() {
  return (
    <Guard perm="capacity.view">
      <CapacityPage />
    </Guard>
  );
}
