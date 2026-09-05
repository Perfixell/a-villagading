export {};

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

const BOOKING_HOLD_MINUTES = 30;
const MAX_STAY_NIGHTS = 30;
const MAX_ADVANCE_DAYS = 730;

type VillaId = 1 | 2;

type CreateBookingPayload = {
  villa_id: VillaId;
  guest_name: string;
  email: string;
  phone: string;
  adults: number;
  children: number;
  check_in: string;
  check_out: string;
  special_requests?: string;
  turnstile_token?: string;
};

type StoredBookingPayload = CreateBookingPayload & {
  booking_reference: string;
  total_price: number;
  payment_access_token_hash: string;
};

type BookingRow = {
  check_in: string;
  check_out: string;
  booking_status: string;
};

type PricingRow = {
  label: string;
  start_date: string;
  end_date: string;
  nightly_price: number;
  minimum_stay: number;
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

function formatLocalYMD(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYmdUtc(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return formatLocalYMD(parsed) === value ? parsed : null;
}

function addUtcDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function isDateRangeBlocked(start: string, end: string, blockedDates: string[]) {
  if (!start || !end) return false;

  const from = parseYmdUtc(start);
  const to = parseYmdUtc(end);
  if (!from || !to || from >= to) return true;

  for (let d = new Date(from); d < to; d = addUtcDays(d, 1)) {
    if (blockedDates.includes(formatLocalYMD(d))) return true;
  }

  return false;
}

async function fetchBlockedDates(supabaseUrl: string, serviceRoleKey: string, villaId: VillaId) {
  const endpoint = `${supabaseUrl}/functions/v1/booking-calendar?villa=${villaId}`;

  const res = await fetch(endpoint, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load blocked dates (${res.status})`);
  }

  const data = (await res.json()) as { blockedDates?: string[] };
  return data.blockedDates ?? [];
}

async function fetchConflictingBookings(
  supabaseUrl: string,
  serviceRoleKey: string,
  villaId: VillaId,
  checkIn: string,
  checkOut: string,
): Promise<BookingRow[]> {
  const endpoint =
    `${supabaseUrl}/rest/v1/bookings` +
    "?select=check_in,check_out,booking_status" +
    `&villa_id=eq.${villaId}` +
    "&booking_status=neq.cancelled" +
    `&check_in=lt.${encodeURIComponent(checkOut)}` +
    `&check_out=gt.${encodeURIComponent(checkIn)}`;

  const res = await fetch(endpoint, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to check booking conflicts (${res.status})`);
  }

  return (await res.json()) as BookingRow[];
}

async function insertBooking(
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: StoredBookingPayload,
) {
  const res = await fetch(`${supabaseUrl}/rest/v1/bookings`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      ...payload,
      payment_status: "pending",
      booking_status: "pending_payment",
      expires_at: new Date(Date.now() + BOOKING_HOLD_MINUTES * 60_000).toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create booking (${res.status}): ${text}`);
  }
}

async function expireStaleBookings(supabaseUrl: string, serviceRoleKey: string) {
  const now = new Date().toISOString();
  const endpoint =
    `${supabaseUrl}/rest/v1/bookings` +
    "?booking_status=eq.pending_payment" +
    `&expires_at=lt.${encodeURIComponent(now)}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    // Keep payment_status within the same values used by the Midtrans webhook.
    // The database rejects the unsupported value "expired" with HTTP 400.
    body: JSON.stringify({ booking_status: "cancelled", payment_status: "failed" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to expire stale bookings (${res.status}): ${text}`);
  }
}

async function validateTurnstile(token: string, secret: string) {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret,
      response: token,
      idempotency_key: crypto.randomUUID(),
    }),
  });
  if (!res.ok) return false;
  const result = (await res.json()) as {
    success?: boolean;
    hostname?: string;
    action?: string;
  };
  return Boolean(
    result.success &&
    result.action === "booking" &&
    (result.hostname === "villagading.com" || result.hostname === "www.villagading.com"),
  );
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function calculateAuthoritativePrice(
  supabaseUrl: string,
  serviceRoleKey: string,
  villaId: VillaId,
  checkIn: string,
  checkOut: string,
) {
  const endpoint =
    `${supabaseUrl}/rest/v1/pricing_periods` +
    "?select=label,start_date,end_date,nightly_price,minimum_stay" +
    `&villa_id=eq.${villaId}&active=eq.true&order=start_date.asc`;
  const res = await fetch(endpoint, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!res.ok) throw new Error(`Failed to load pricing (${res.status})`);

  const periods = (await res.json()) as PricingRow[];
  const start = parseYmdUtc(checkIn);
  const end = parseYmdUtc(checkOut);
  if (!start || !end || start >= end) throw new Error("Invalid stay dates");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const latestAllowed = addUtcDays(today, MAX_ADVANCE_DAYS);
  const requestedNights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (start < today || start > latestAllowed || requestedNights > MAX_STAY_NIGHTS) {
    throw new Error("Stay dates are outside the allowed booking window");
  }

  let total = 0;
  let nights = 0;
  let minimumStay = 1;
  for (let date = new Date(start); date < end; date = addUtcDays(date, 1)) {
    const ymd = formatLocalYMD(date);
    const period = periods.find((row) => ymd >= row.start_date && ymd <= row.end_date);
    if (!period) throw new Error(`No pricing configured for ${ymd}`);
    total += Number(period.nightly_price);
    minimumStay = Math.max(minimumStay, Number(period.minimum_stay) || 1);
    nights += 1;
  }
  if (nights < minimumStay) throw new Error(`This stay requires at least ${minimumStay} nights`);
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error("Invalid calculated price");
  return total;
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
    // This public function holds inventory, so a missing deployment secret
    // must disable booking rather than silently disable bot protection.
    const turnstileSecret = getEnv("TURNSTILE_SECRET_KEY");

    if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return json({ error: "Content-Type must be application/json" }, 415);
    }

    const payload = await readJsonBody<CreateBookingPayload>(req, 16_384);

    if (
      (payload.villa_id !== 1 && payload.villa_id !== 2) ||
      !payload.guest_name ||
      !payload.email ||
      !payload.phone ||
      !payload.check_in ||
      !payload.check_out
    ) {
      return json({ error: "Missing required booking fields" }, 400);
    }

    if (
      payload.guest_name.trim().length < 2 || payload.guest_name.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) || payload.email.length > 254 ||
      payload.phone.length > 40 || !Number.isInteger(payload.adults) || !Number.isInteger(payload.children) ||
      payload.adults < 1 || payload.children < 0 || payload.adults + payload.children > 6 ||
      (payload.special_requests?.length ?? 0) > 2000
    ) {
      return json({ error: "Invalid booking details" }, 400);
    }

    if (!payload.turnstile_token || payload.turnstile_token.length > 2048) {
      return json({ error: "Security verification is required" }, 403);
    }
    if (!(await validateTurnstile(payload.turnstile_token, turnstileSecret))) {
      return json({ error: "Security verification failed. Please try again." }, 403);
    }

    const totalPrice = await calculateAuthoritativePrice(
      supabaseUrl,
      serviceRoleKey,
      payload.villa_id,
      payload.check_in,
      payload.check_out,
    );

    await expireStaleBookings(supabaseUrl, serviceRoleKey);
    const blockedDates = await fetchBlockedDates(supabaseUrl, serviceRoleKey, payload.villa_id);

    if (isDateRangeBlocked(payload.check_in, payload.check_out, blockedDates)) {
      return json(
        { error: "Those dates are unavailable. Please choose different dates." },
        409,
      );
    }

    const conflicts = await fetchConflictingBookings(
      supabaseUrl,
      serviceRoleKey,
      payload.villa_id,
      payload.check_in,
      payload.check_out,
    );

    if (conflicts.length > 0) {
      return json(
        { error: "Those dates were just booked by another guest. Please choose different dates." },
        409,
      );
    }

    const bookingReference = `VG-${crypto.randomUUID().toUpperCase()}`;
    const paymentToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
    await insertBooking(supabaseUrl, serviceRoleKey, {
      ...payload,
      guest_name: payload.guest_name.trim(),
      email: payload.email.trim().toLowerCase(),
      special_requests: payload.special_requests?.trim(),
      turnstile_token: undefined,
      booking_reference: bookingReference,
      total_price: totalPrice,
      payment_access_token_hash: await sha256Hex(paymentToken),
    });

    return json({
      ok: true,
      booking_reference: bookingReference,
      total_price: totalPrice,
      payment_token: paymentToken,
    }, 201);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return json({ error: "Request is too large" }, 413);
    }
    if (error instanceof SyntaxError) {
      return json({ error: "Invalid JSON payload" }, 400);
    }
    console.error("booking-create failed", error);
    return json(
      { error: "Booking could not be created. Please try again." },
      500,
    );
  }
});
