import { ReservationsClient } from "@/app/components/DataClients";
import { PageHeader } from "@/app/components/ui";

export default function ReservationsPage() {
  return (
    <>
      <PageHeader
        title="Reservas"
        description="Creacion manual, limite de 4 reservas activas, cancelacion y vencimiento para pruebas de la futura app movil."
      />
      <ReservationsClient />
    </>
  );
}
