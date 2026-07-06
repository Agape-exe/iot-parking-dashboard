import { SimulatorClient } from "@/app/components/DataClients";
import { PageHeader } from "@/app/components/ui";

export default function SimulatorPage() {
  return (
    <>
      <PageHeader title="Simulador web RFID" description="Prueba los endpoints temporales IoT sin hardware fisico usando UIDs de ejemplo." />
      <SimulatorClient />
    </>
  );
}
