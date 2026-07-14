import { requireAdmin } from "@/lib/auth-server";
import { listUsers, updateUserStatus } from "@/lib/admin-data-service";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    return Response.json({ users: await listUsers(url.searchParams.get("search") ?? "") });
  } catch (error) {
    console.error("[api/admin/users]", error);
    return Response.json({ users: [] });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const user = await updateUserStatus(body.userId, body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE");
    return Response.json({ message: "Usuario actualizado", user });
  } catch (error) {
    console.error("[api/admin/users:patch]", error);
    return Response.json({ message: "No se pudo actualizar el usuario." }, { status: 500 });
  }
}
