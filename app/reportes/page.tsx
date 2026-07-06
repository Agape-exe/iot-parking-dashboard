import { ReportsClient } from "@/app/components/DataClients";
import { PageHeader } from "@/app/components/ui";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reportes de eventos" description="Tabla filtrable de ingresos, pagos, salidas, denegaciones, intentos duplicados y aforo lleno." />
      <ReportsClient />
    </>
  );
}
