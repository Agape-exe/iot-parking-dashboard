import { DashboardClient } from "@/app/components/DataClients";
import { PageHeader } from "@/app/components/ui";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard principal" description="Indicadores operativos del estacionamiento, calculados desde sesiones activas y eventos del dia." />
      <DashboardClient />
    </>
  );
}
