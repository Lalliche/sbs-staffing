"use client";
import { use } from "react";
import { Guard } from "@/components/app/Guard";
import { MissionPage } from "@/components/missions/MissionPage";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Guard perm="project.view">
      <MissionPage id={id} />
    </Guard>
  );
}
