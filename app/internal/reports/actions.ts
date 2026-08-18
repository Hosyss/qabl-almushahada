"use server";

import { revalidatePath } from "next/cache";

import { requireInternalSessionUser } from "@/app/internal-session";
import {
  dismissPublicReportIntake,
  promotePublicReportIntake,
} from "@/db/public-report-triage-service";

export async function dismissPublicReportIntakeAction(formData: FormData) {
  const sessionUser = await requireInternalSessionUser();
  await dismissPublicReportIntake({
    sessionEmail: sessionUser.email,
    intakeId: readString(formData, "intakeId"),
    expectedRevision: readRevision(formData, "expectedRevision"),
    note: readString(formData, "note"),
  });
  revalidatePath("/internal/reports");
}

export async function promotePublicReportIntakeAction(formData: FormData) {
  const sessionUser = await requireInternalSessionUser();
  await promotePublicReportIntake({
    sessionEmail: sessionUser.email,
    intakeId: readString(formData, "intakeId"),
    expectedRevision: readRevision(formData, "expectedRevision"),
    materialReportType: readString(formData, "materialReportType"),
    note: readString(formData, "note"),
  });
  revalidatePath("/internal/reports");
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readRevision(formData: FormData, name: string): number {
  const value = Number(readString(formData, name));
  return Number.isInteger(value) ? value : -1;
}
