"use client";
import { Guard } from "@/components/app/Guard";
import { TimesheetsPage } from "@/components/timesheets/Timesheets";

export default function Page() {
  return (
    <Guard any={["timesheet.own", "timesheet.view", "timesheet.validate"]}>
      <TimesheetsPage />
    </Guard>
  );
}
