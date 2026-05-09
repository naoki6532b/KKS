"use client";

import { useParams } from "next/navigation";
import { Header } from "@/app/components/header";
import { SalaryForm } from "@/app/components/salary-form";

export default function EditSalaryPage() {
  const params = useParams();
  const id = params.id as string;
  return (
    <>
      <Header />
      <SalaryForm mode="edit" slipId={id} />
    </>
  );
}
