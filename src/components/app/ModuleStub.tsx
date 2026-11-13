"use client";
import { Hammer } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/Surface";

/** Transitional placeholder, replaced by the module's real page during Phase 2-8. */
export function ModuleStub({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} description="Module en cours d’intégration." />
      <EmptyState icon={Hammer} title={title} description="Cette page est en cours de construction." />
    </>
  );
}
