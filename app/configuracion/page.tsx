import { SettingsClient } from "@/app/components/DataClients";
import { PageHeader } from "@/app/components/ui";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Configuracion y mantenimiento"
        description="Ajustes de pruebas, fecha operativa y mantenimiento interno de datos demo."
      />
      <SettingsClient />
    </>
  );
}
