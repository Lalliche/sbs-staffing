"use client";
import { Guard } from "@/components/app/Guard";
import { SkillsPage } from "@/components/skills/Skills";

export default function Page() {
  return (
    <Guard perm="skill.view">
      <SkillsPage />
    </Guard>
  );
}
