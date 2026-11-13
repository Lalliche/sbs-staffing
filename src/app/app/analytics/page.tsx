"use client";
import { Guard } from "@/components/app/Guard";
import { AnalyticsPage } from "@/components/analytics/Analytics";

export default function Page() {
  return (
    <Guard perm="analytics.view">
      <AnalyticsPage />
    </Guard>
  );
}
