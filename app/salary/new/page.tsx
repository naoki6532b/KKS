import { Header } from "@/app/components/header";
import { SalaryForm } from "@/app/components/salary-form";

export default function NewSalaryPage() {
  return (
    <>
      <Header />
      <SalaryForm mode="new" />
    </>
  );
}
