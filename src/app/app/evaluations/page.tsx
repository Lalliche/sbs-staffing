"use client";
import { Guard } from "@/components/app/Guard";
import { EvaluationsPage } from "@/components/evaluations/Evaluations";

export default function Page() {
  return (
    <Guard perm="evaluation.view">
      <EvaluationsPage />
    </Guard>
  );
}
