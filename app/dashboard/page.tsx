import { DashboardClient } from "@/app/components/DataClients";
import { PageHeader } from "@/app/components/ui";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard principal" description="Indicadores operativos, reservas y graficos de ocupacion calculados desde Supabase." />
      <DashboardClient />
    </>
  );
}
