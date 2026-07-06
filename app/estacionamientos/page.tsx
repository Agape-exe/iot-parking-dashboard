import { SpacesClient } from "@/app/components/DataClients";
import { PageHeader } from "@/app/components/ui";

export default function ParkingSpacesPage() {
  return (
    <>
      <PageHeader title="Vista de estacionamientos" description="Diez espacios numerados. La ocupacion se controla por sesiones RFID activas, no por sensores individuales." />
      <SpacesClient />
    </>
  );
}
