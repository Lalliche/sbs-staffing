"use client";
import { use } from "react";
import { Guard } from "@/components/app/Guard";
import { Fiche } from "@/components/people/Fiche";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Guard perm="employee.view">
      <Fiche id={id} />
    </Guard>
  );
}
