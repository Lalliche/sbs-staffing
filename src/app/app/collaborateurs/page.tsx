"use client";
import { Guard } from "@/components/app/Guard";
import { PeoplePage } from "@/components/people/People";

export default function Page() {
  return (
    <Guard perm="employee.view">
      <PeoplePage />
    </Guard>
  );
}
