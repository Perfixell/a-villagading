export {};

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

type BookingRow = {
  id: string;
  booking_reference: string;
  villa_id: number;
  guest_name: string;
  email: string;
  phone: string;
  check_in: string;
  check_out: string;
  total_price: number;
  payment_status: string;
  booking_status: string;
  midtrans_order_id: string | null;
  expires_at: string | null;
  payment_access_token_hash: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

class RequestBodyTooLargeError extends Error {}

async function readJsonBody<T>(req: Request, maxBytes: number): Promise<T> {
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }
  if (!req.body) throw new SyntaxError("Missing request body");

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body)) as T;
}

function toBasicAuth(serverKey: string) {
  return `Basic ${btoa(`${serverKey}:`)}`;
}

function buildOrderId(existingOrderId: string | null, bookingReference: string) {
  if (existingOrderId) return existingOrderId;
  return `${bookingReference}-${Date.now()}`;
}

async function fetchBookingByReference(
  supabaseUrl: string,
  serviceRoleKey: string,
  bookingReference: string,
): Promise<BookingRow | null> {
  const endpoint =
    `${supabaseUrl}/rest/v1/bookings` +
    "?select=id,booking_reference,villa_id,guest_name,email,phone,check_in,check_out,total_price,payment_status,booking_status,midtrans_order_id,expires_at,payment_access_token_hash" +
    `&booking_reference=eq.${encodeURIComponent(bookingReference)}` +
    "&limit=1";

  const res = await fetch(endpoint, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch booking (${res.status})`);
  }

  const rows = (await res.json()) as BookingRow[];
  return rows[0] ?? null;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

async function updateBookingPaymentData(
  supabaseUrl: string,
  serviceRoleKey: string,
  bookingReference: string,
  orderId: string,
) {
  const endpoint =
    `${supabaseUrl}/rest/v1/bookings` +
    `?booking_reference=eq.${encodeURIComponent(bookingReference)}`;

  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      midtrans_order_id: orderId,
      payment_provider: "midtrans",
      booking_status: "pending_payment",
      payment_status: "pending",
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to update booking payment data (${res.status})`);
  }
}

type MidtransResponse = {
  token: string;
  redirect_url: string;
};

async function createSnapTransaction(
  serverKey: string,
  isProduction: boolean,
  booking: BookingRow,
  orderId: string,
): Promise<MidtransResponse> {
  const baseUrl = isProduction
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";

  const body = {
    transaction_details: {
      order_id: orderId,
      gross_amount: Math.max(1, Math.round(booking.total_price)),
    },
    customer_details: {
      first_name: booking.guest_name,
      email: booking.email,
      phone: booking.phone,
    },
    item_details: [
      {
        id: `villa-${booking.villa_id}`,
        name: `Villa Booking ${booking.check_in} to ${booking.check_out}`,
        quantity: 1,
        price: Math.max(1, Math.round(booking.total_price)),
      },
    ],
  };

  const res = await fetch(`${baseUrl}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      Authorization: toBasicAuth(serverKey),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Midtrans transaction failed (${res.status}): ${text}`);
  }

  return (await res.json()) as MidtransResponse;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const midtransServerKey = getEnv("MIDTRANS_SERVER_KEY");
    const isProduction = (Deno.env.get("MIDTRANS_IS_PRODUCTION") ?? "false") === "true";

    if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return json({ error: "Content-Type must be application/json" }, 415);
    }

    const body = await readJsonBody<{ bookingReference?: string; paymentToken?: string }>(req, 4096);
    const bookingReference = body.bookingReference?.trim();
    const paymentToken = body.paymentToken?.trim();

    if (!bookingReference || bookingReference.length > 80 || !paymentToken || paymentToken.length !== 64) {
      return json({ error: "Invalid payment request" }, 400);
    }

    const booking = await fetchBookingByReference(
      supabaseUrl,
      serviceRoleKey,
      bookingReference,
    );

    if (!booking) {
      return json({ error: "Booking not found" }, 404);
    }

    const suppliedTokenHash = await sha256Hex(paymentToken);
    if (
      !booking.payment_access_token_hash ||
      !constantTimeEqual(suppliedTokenHash, booking.payment_access_token_hash)
    ) {
      return json({ error: "Booking not found" }, 404);
    }

    if (
      booking.booking_status === "cancelled" ||
      (booking.expires_at && new Date(booking.expires_at).getTime() <= Date.now())
    ) {
      return json({ error: "This payment session has expired. Please create a new booking." }, 410);
    }

    if (booking.payment_status === "paid") {
      return json({
        status: "paid",
        message: "Booking already paid",
      });
    }

    const orderId = buildOrderId(booking.midtrans_order_id, booking.booking_reference);
    const midtrans = await createSnapTransaction(
      midtransServerKey,
      isProduction,
      booking,
      orderId,
    );

    await updateBookingPaymentData(
      supabaseUrl,
      serviceRoleKey,
      booking.booking_reference,
      orderId,
    );

    return json({
      status: "pending",
      token: midtrans.token,
      redirectUrl: midtrans.redirect_url,
      orderId,
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return json({ error: "Request is too large" }, 413);
    }
    if (error instanceof SyntaxError) {
      return json({ error: "Invalid JSON payload" }, 400);
    }
    console.error("midtrans-create-transaction failed", error);
    return json(
      {
        error: "Payment could not be started. Please try again.",
      },
      500,
    );
  }
});
