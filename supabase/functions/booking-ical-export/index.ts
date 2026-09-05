export {};

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type VillaId = 1 | 2;
type BookingRow = { check_in: string; check_out: string };

function getEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function toIcsDate(ymd: string) {
  return ymd.replaceAll("-", "");
}

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function buildIcs(villaId: VillaId, bookings: BookingRow[]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Villa Gading//Availability Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  // Booking.com rejects otherwise-valid calendars that contain no VEVENTs.
  // A fixed event in the distant past keeps an empty villa feed importable
  // without blocking any current or future availability.
  if (bookings.length === 0) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:villa-${villaId}-calendar-validation@villagading`,
      "DTSTAMP:20990101T000000Z",
      "DTSTART;VALUE=DATE:20990101",
      "DTEND;VALUE=DATE:20990102",
      "STATUS:CANCELLED",
      "TRANSP:TRANSPARENT",
      "SUMMARY:Calendar validation marker",
      "END:VEVENT",
    );
  }

  for (const booking of bookings) {
    // Calendar importers need only blocked dates. Never export guest identity,
    // contact details, or the payment-capable booking reference.
    lines.push(
      "BEGIN:VEVENT",
      `UID:villa-${villaId}-${toIcsDate(booking.check_in)}-${toIcsDate(booking.check_out)}@villagading`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
      `DTSTART;VALUE=DATE:${toIcsDate(booking.check_in)}`,
      `DTEND;VALUE=DATE:${toIcsDate(booking.check_out)}`,
      `SUMMARY:Villa ${villaId} unavailable`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

async function fetchBookings(supabaseUrl: string, serviceRoleKey: string, villaId: VillaId) {
  const endpoint =
    `${supabaseUrl}/rest/v1/bookings` +
    "?select=check_in,check_out" +
    `&villa_id=eq.${villaId}` +
    "&booking_status=neq.cancelled" +
    `&or=(booking_status.neq.pending_payment,expires_at.gt.${encodeURIComponent(new Date().toISOString())})` +
    "&order=check_in.asc";

  const res = await fetch(endpoint, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch bookings (${res.status})`);
  return (await res.json()) as BookingRow[];
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET", "Cache-Control": "no-store" },
    });
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const expectedToken = getEnv("BOOKING_ICAL_EXPORT_TOKEN");
    const url = new URL(req.url);

    if (!constantTimeEqual(url.searchParams.get("token") ?? "", expectedToken)) {
      return new Response("Not found", {
        status: 404,
        headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      });
    }

    const villaId = Number(url.searchParams.get("villa")) as VillaId;
    if (villaId !== 1 && villaId !== 2) {
      return new Response("Invalid villa", {
        status: 400,
        headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      });
    }

    const bookings = await fetchBookings(supabaseUrl, serviceRoleKey, villaId);
    return new Response(buildIcs(villaId, bookings), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("booking-ical-export failed", error);
    return new Response("Calendar temporarily unavailable", {
      status: 500,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
});
