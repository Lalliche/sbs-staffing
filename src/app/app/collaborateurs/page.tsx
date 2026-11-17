"use client";
import { Guard } from "@/components/app/Guard";
import { Fiche } from "@/components/people/Fiche";
import { PeoplePage } from "@/components/people/People";
import { useSession } from "@/lib/store/hooks";
import { isSelfView } from "@/lib/store/selectors/core";

/** Managers, RH, RM… see the directory; a Collaborateur only ever sees themselves, so they land on their own profile. */
export default function Page() {
  const { s, me } = useSession();
  const self = isSelfView(s) && me?.employeeId;
  return (
    <Guard perm="employee.view">
      {self ? <Fiche id={self} /> : <PeoplePage />}
    </Guard>
  );
}
