type IotRequestData = {
  uid: string;
  deviceId: string | null;
  point: string | null;
};

export async function readIotRequest(request: Request): Promise<{ ok: true; data: IotRequestData } | { ok: false; response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    console.error("[iot:invalid-json]", error);
    return {
      ok: false,
      response: Response.json({ allowed: false, message: "El cuerpo de la solicitud no contiene JSON valido." }, { status: 400 }),
    };
  }

  if (!body || typeof body !== "object") {
    return {
      ok: false,
      response: Response.json({ allowed: false, message: "La solicitud no contiene datos validos." }, { status: 400 }),
    };
  }

  const input = body as Record<string, unknown>;
  const uid = typeof input.uid === "string" ? input.uid.trim() : "";
  if (!uid) {
    return {
      ok: false,
      response: Response.json({ allowed: false, message: "UID requerido" }, { status: 400 }),
    };
  }

  return {
    ok: true,
    data: {
      uid,
      deviceId: typeof input.deviceId === "string" ? input.deviceId : null,
      point: typeof input.point === "string" ? input.point : null,
    },
  };
}

export function iotErrorResponse(context: string, error: unknown) {
  console.error(context, error);
  const payload: { allowed: false; message: string; debug?: string } = {
    allowed: false,
    message: "No se pudo procesar la solicitud. Revise la configuracion de base de datos.",
  };

  if (process.env.NODE_ENV === "development") {
    payload.debug = error instanceof Error ? error.message : String(error);
  }

  return Response.json(payload, { status: 500 });
}
