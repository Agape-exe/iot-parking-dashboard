import { SpacesClient } from "@/app/components/DataClients";
import { PageHeader } from "@/app/components/ui";

export default function ParkingSpacesPage() {
  return (
    <>
      <PageHeader title="Vista de estacionamientos" description="Plano visual de los 9 espacios con UID, placa, propietario, tiempo y monto estimado." />
      <SpacesClient />
    </>
  );
}
