import { ReportsClient } from "@/app/components/DataClients";
import { PageHeader } from "@/app/components/ui";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reportes" description="Filtros por fecha, UID, placa, usuario y evento; reporte por placa, horarios pico y exportacion CSV." />
      <ReportsClient />
    </>
  );
}
