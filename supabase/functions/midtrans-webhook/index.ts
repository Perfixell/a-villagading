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

type MidtransWebhookPayload = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  settlement_time?: string;
};

type BookingRow = {
  id: string;
  booking_reference: string;
  villa_id: number;
  guest_name: string;
  email: string;
  check_in: string;
  check_out: string;
  total_price: number;
  payment_status: string;
  booking_status: string;
  paid_at: string | null;
  confirmation_email_sent_at: string | null;
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function fetchBookingByOrderId(
  supabaseUrl: string,
  serviceRoleKey: string,
  orderId: string,
): Promise<BookingRow | null> {
  const endpoint =
    `${supabaseUrl}/rest/v1/bookings` +
    "?select=id,booking_reference,villa_id,guest_name,email,check_in,check_out,total_price,payment_status,booking_status,paid_at,confirmation_email_sent_at" +
    `&midtrans_order_id=eq.${encodeURIComponent(orderId)}` +
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

async function markConfirmationEmailSent(
  supabaseUrl: string,
  serviceRoleKey: string,
  bookingId: string,
) {
  const endpoint = `${supabaseUrl}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`;

  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ confirmation_email_sent_at: new Date().toISOString() }),
  });

  if (!res.ok) {
    throw new Error(`Failed to mark confirmation email sent (${res.status})`);
  }
}

async function sendConfirmationEmail(
  booking: BookingRow,
  resendApiKey: string,
  fromEmail: string,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [booking.email],
      bcc: ["villagading27@gmail.com"],
      subject: `Booking confirmed: ${booking.booking_reference}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
          <h2>Your Villa Booking is Confirmed</h2>
          <p>Hi ${booking.guest_name}, your payment has been received and your booking is confirmed.</p>
          <p><strong>Reference:</strong> ${booking.booking_reference}</p>
          <p><strong>Villa:</strong> Villa ${booking.villa_id}</p>
          <p><strong>Check-in:</strong> ${booking.check_in}</p>
          <p><strong>Check-out:</strong> ${booking.check_out}</p>
          <p><strong>Total:</strong> ${formatCurrency(booking.total_price)}</p>
          <p>Keep this email for your check-in.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend email failed (${response.status}): ${text}`);
  }
}

async function sha512Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-512", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function mapStatuses(payload: MidtransWebhookPayload) {
  const status = payload.transaction_status;

  if (status === "settlement" || status === "capture") {
    if (status === "capture" && payload.fraud_status === "challenge") {
      return {
        payment_status: "pending",
        booking_status: "pending_payment",
      };
    }

    return {
      payment_status: "paid",
      booking_status: "confirmed",
    };
  }

  if (status === "pending") {
    return {
      payment_status: "pending",
      booking_status: "pending_payment",
    };
  }

  if (status === "deny" || status === "expire" || status === "cancel") {
    return {
      payment_status: "failed",
      booking_status: "cancelled",
    };
  }

  return {
    payment_status: "pending",
    booking_status: "pending_payment",
  };
}

async function updateBookingFromWebhook(
  supabaseUrl: string,
  serviceRoleKey: string,
  orderId: string,
  patchData: Record<string, unknown>,
) {
  const endpoint = `${supabaseUrl}/rest/v1/bookings?midtrans_order_id=eq.${encodeURIComponent(orderId)}`;

  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patchData),
  });

  if (!res.ok) {
    throw new Error(`Failed to update booking from webhook (${res.status})`);
  }
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "";

    const payload = (await req.json()) as MidtransWebhookPayload;

    if (
      !payload.order_id ||
      !payload.status_code ||
      !payload.gross_amount ||
      !payload.signature_key ||
      !payload.transaction_status
    ) {
      return json({ error: "Invalid payload" }, 400);
    }

    const rawSignature =
      payload.order_id + payload.status_code + payload.gross_amount + midtransServerKey;
    const expectedSignature = await sha512Hex(rawSignature);

    if (expectedSignature !== payload.signature_key) {
      return json({ error: "Invalid signature" }, 401);
    }

    const booking = await fetchBookingByOrderId(supabaseUrl, serviceRoleKey, payload.order_id);
    if (!booking) {
      return json({ error: "Booking not found" }, 404);
    }

    const statusPatch = mapStatuses(payload);
    const patchData: Record<string, unknown> = {
      ...statusPatch,
    };

    if (statusPatch.payment_status === "paid") {
      patchData.paid_at = payload.settlement_time ?? new Date().toISOString();
    }

    await updateBookingFromWebhook(
      supabaseUrl,
      serviceRoleKey,
      payload.order_id,
      patchData,
    );

    if (
      statusPatch.payment_status === "paid" &&
      booking.confirmation_email_sent_at === null &&
      resendApiKey &&
      resendFromEmail
    ) {
      try {
        await sendConfirmationEmail(booking, resendApiKey, resendFromEmail);
        await markConfirmationEmailSent(supabaseUrl, serviceRoleKey, booking.id);
      } catch (emailError) {
        console.error("Confirmation email failed:", emailError);
      }
    }

    return json({ ok: true });
  } catch (error) {
    return json(
      {
        error: String(error instanceof Error ? error.message : error),
      },
      500,
    );
  }
});
