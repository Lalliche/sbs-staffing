"use client";
import { Guard } from "@/components/app/Guard";
import { Availability } from "@/components/availability/Availability";

export default function Page() {
  return (
    <Guard any={["availability.view", "leave.request"]}>
      <Availability />
    </Guard>
  );
}
