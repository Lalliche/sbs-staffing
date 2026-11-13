"use client";
import { Guard } from "@/components/app/Guard";
import { MissionList } from "@/components/missions/MissionList";

export default function Page() {
  return (
    <Guard perm="project.view">
      <MissionList />
    </Guard>
  );
}
