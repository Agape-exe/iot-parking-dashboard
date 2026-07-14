import { SessionsClient } from "@/app/components/DataClients";
import { PageHeader } from "@/app/components/ui";

export default function VehiclesPage() {
  return (
    <>
      <PageHeader title="Vehiculos dentro" description="Sesiones activas con placa, propietario, tiempo transcurrido, monto estimado y confirmacion manual de pago." />
      <SessionsClient />
    </>
  );
}
