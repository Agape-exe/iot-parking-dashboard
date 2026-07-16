import { ReportsClient } from "@/app/components/DataClients";
import { PageHeader } from "@/app/components/ui";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reportes" description="Periodos por dia, semana, mes o rango personalizado en hora de Lima, con filtros y exportacion CSV." />
      <ReportsClient />
    </>
  );
}
