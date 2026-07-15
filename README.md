# IoT Parking Dashboard

Dashboard web para el proyecto universitario "Sistema de gestion inteligente para un estacionamiento vehicular mediante IoT".

Incluye login con Supabase Auth, panel administrativo, vista de 10 espacios, sesiones activas, confirmacion de pagos, reportes filtrables, exportacion CSV y endpoints HTTP temporales para simular eventos desde ESP32/Wokwi.

## Variables de entorno

Configura estas variables en `.env.local` y tambien en Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RFID_ENROLLMENT_TEST_MODE=true
NEXT_PUBLIC_TOTAL_SPACES=10
NEXT_PUBLIC_RATE_PER_MINUTE=0.10
NEXT_PUBLIC_DEMO_MODE=true
```

La `SUPABASE_SERVICE_ROLE_KEY` se usa solo en rutas del servidor. No debe exponerse en componentes cliente.
`RFID_ENROLLMENT_TEST_MODE=true` habilita temporalmente la simulación manual desde la app móvil. Desactívala o elimínala cuando el ESP32 esté actualizado.

`NEXT_PUBLIC_DEMO_MODE=true` permite probar el panel localmente sin bloquear las rutas `/api/admin/*` por 401. Para usar autenticacion real, cambia a `NEXT_PUBLIC_DEMO_MODE=false`, crea un usuario en Supabase Auth e inicia sesion desde `/login`.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. En SQL Editor, copia y ejecuta todo el contenido de `supabase/schema.sql`.
3. En Authentication, crea un usuario administrador con email y contrasena.
4. Copia la URL del proyecto, anon key y service role key hacia `.env.local`.
5. Confirma que existan las tablas del sistema, incluida `rfid_enrollments`, y las columnas `is_demo` en `app_users` y `vehicles`.
6. Confirma que `parking_spaces` tenga 10 registros en la columna `number`, del 1 al 10.

El script es idempotente: puede ejecutarse de nuevo para agregar tablas, columnas, índices, restricciones y funciones faltantes sin eliminar los datos existentes.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. Si `NEXT_PUBLIC_DEMO_MODE=true`, entraras al dashboard sin login. Usa el simulador RFID para generar datos.

## Desplegar en Vercel

1. Sube el repositorio a GitHub.
2. Importa el proyecto desde Vercel.
3. Agrega las mismas variables de entorno.
4. Despliega con el framework detectado como Next.js.
5. En Supabase Auth, agrega la URL de Vercel en los dominios/redirecciones permitidas si tu configuracion lo requiere.

## Rutas principales

- `/login`: login de administrador.
- `/dashboard`: indicadores principales.
- `/estacionamientos`: 10 espacios numerados.
- `/vehiculos`: sesiones activas y confirmacion de pago.
- `/reportes`: eventos filtrables y exportacion CSV.
- `/simulador`: pruebas RFID sin hardware.
- `GET /api/admin/overview`: resumen del panel.
- `GET /api/admin/spaces`: espacios.
- `GET /api/admin/sessions`: sesiones activas.
- `GET /api/admin/events`: eventos filtrables.
- `POST /api/admin/payments`: confirmacion de pago desde el panel.
- `POST /api/iot/entry`: ingreso temporal IoT.
- `POST /api/iot/payment-request`: calculo de pago sin confirmar.
- `POST /api/iot/exit`: salida autorizada solo con pago confirmado.
- `POST /api/mobile/rfid-enrollments/start`: inicia una vinculación RFID de 60 segundos.
- `GET /api/mobile/rfid-enrollments/:id`: consulta y actualiza el estado de la vinculación.
- `PATCH /api/mobile/rfid-enrollments/:id/cancel`: cancela una vinculación pendiente.
- `POST /api/iot/rfid-enrollment/scan`: procesa la lectura de vinculación sin abrir la barrera.

## Errores corregidos

- `Could not find the table 'public.events'`: Supabase no tenia ejecutado el SQL o el cache apuntaba a tablas no creadas. Ejecuta `supabase/schema.sql`.
- `Could not find the table 'public.parking_sessions'`: faltaba la tabla o tenia un esquema anterior incompatible.
- `500 Internal Server Error`: las rutas consultaban relaciones/columnas que no coincidian con el SQL. Ahora el codigo usa `parking_spaces.number` y `parking_sessions.space_number`.
- `401 Unauthorized`: las rutas admin requieren token. En local puedes usar `NEXT_PUBLIC_DEMO_MODE=true`; en produccion usa `false` y login real.

## Ejemplos de payload IoT

```json
{
  "deviceId": "ESP32_ENTRADA_01",
  "uid": "A1B2C3D4",
  "point": "entrada"
}
```

```json
{
  "deviceId": "ESP32_CASETA_01",
  "uid": "A1B2C3D4",
  "point": "caseta"
}
```

## Pruebas manuales

1. Dashboard vacio: entra a `/dashboard`; debe mostrar 10 espacios, 10 libres y 0 ocupados.
2. Simular ingreso: entra a `/simulador`, usa `01020304` o `A1B2C3D4` y presiona "Simular ingreso".
3. Intentar doble ingreso: vuelve a presionar "Simular ingreso" con el mismo UID; debe responder `allowed: false`.
4. Solicitar pago: presiona "Solicitar pago"; debe calcular minutos y monto sin confirmar pago.
5. Confirmar pago: ve a `/vehiculos` y presiona "Confirmar pago".
6. Simular salida: vuelve a `/simulador` y presiona "Simular salida"; debe liberar el espacio.
7. Revisar reportes: entra a `/reportes`; deben verse los eventos `INGRESO`, `PAGO_SOLICITADO`, `PAGO` y `SALIDA`.
