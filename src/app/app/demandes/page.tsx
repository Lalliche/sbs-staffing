"use client";
import { Guard } from "@/components/app/Guard";
import { RequestsPage } from "@/components/requests/Requests";

export default function Page() {
  return (
    <Guard perm="request.view">
      <RequestsPage />
    </Guard>
  );
}
