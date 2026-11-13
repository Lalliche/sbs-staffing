"use client";
import { Guard } from "@/components/app/Guard";
import { MarketplacePage } from "@/components/marketplace/Marketplace";

export default function Page() {
  return (
    <Guard perm="marketplace.view">
      <MarketplacePage />
    </Guard>
  );
}
