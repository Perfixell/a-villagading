// supabase/functions/booking-calendar/index.ts
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

type VillaId = 1 | 2;

const CALENDARS: Record<VillaId, string> = {
  1: Deno.env.get("BOOKING_ICAL_VILLA_1") ?? "",
  2: Deno.env.get("BOOKING_ICAL_VILLA_2") ?? "",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function unfoldIcs(text: string) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function parseIcsDate(raw: string): Date | null {
  const allDay = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (allDay) {
    const [, y, m, d] = allDay;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  const dt = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (dt) {
    const [, y, m, d, hh, mm, ss, z] = dt;
    const iso = z
      ? `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`
      : `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function toYmd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function parseYmdUtc(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function expandYmdRange(startYmd: string, endYmd: string) {
  const blocked = new Set<string>();
  const start = parseYmdUtc(startYmd);
  const end = parseYmdUtc(endYmd);

  if (!start || !end || start >= end) return blocked;

  for (let d = new Date(start); d < end; d = addUtcDays(d, 1)) {
    blocked.add(toYmd(d));
  }

  return blocked;
}

function parseCalendarEvents(icsText: string) {
  const unfolded = unfoldIcs(icsText);
  const lines = unfolded.split(/\r?\n/);

  const events: Array<{ start: string; end: string; summary: string }> = [];
  let insideEvent = false;
  let current: Record<string, string> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      insideEvent = true;
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (current.DTSTART && current.DTEND) {
        events.push({
          start: current.DTSTART,
          end: current.DTEND,
          summary: current.SUMMARY ?? "",
        });
      }
      insideEvent = false;
      current = {};
      continue;
    }

    if (!insideEvent) continue;

    const colon = line.indexOf(":");
    if (colon === -1) continue;

    const key = line.slice(0, colon).split(";")[0];
    const value = line.slice(colon + 1);
    current[key] = value;
  }

  return events;
}

function expandBookedDates(events: Array<{ start: string; end: string }>) {
  const blocked = new Set<string>();

  for (const event of events) {
    const start = parseIcsDate(event.start);
    const end = parseIcsDate(event.end);

    if (!start || !end) continue;

    for (let d = new Date(start); d < end; d = addUtcDays(d, 1)) {
      blocked.add(toYmd(d));
    }
  }

  return Array.from(blocked).sort();
}

async function fetchCalendar(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/calendar,text/plain,*/*",
      },
    });

    if (!res.ok) {
      throw new Error(`Calendar fetch failed (${res.status})`);
    }

    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

type SupabaseBookingRow = {
  check_in: string;
  check_out: string;
};

async function fetchSupabaseBookings(villaId: VillaId): Promise<SupabaseBookingRow[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const endpoint =
    `${SUPABASE_URL}/rest/v1/bookings` +
    `?select=check_in,check_out` +
    `&villa_id=eq.${villaId}` +
    `&booking_status=neq.cancelled` +
    `&or=(booking_status.neq.pending_payment,expires_at.gt.${encodeURIComponent(new Date().toISOString())})`;

  const res = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Supabase bookings fetch failed (${res.status})`);
  }

  const rows = (await res.json()) as SupabaseBookingRow[];
  return Array.isArray(rows) ? rows : [];
}

function expandSupabaseBlockedDates(rows: SupabaseBookingRow[]) {
  const blocked = new Set<string>();

  for (const row of rows) {
    const rangeDates = expandYmdRange(row.check_in, row.check_out);
    for (const d of rangeDates) blocked.add(d);
  }

  return blocked;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const villaParam = url.searchParams.get("villa");
    const villaId = Number(villaParam) as VillaId;

    if (villaId !== 1 && villaId !== 2) {
      return json({ error: "Invalid villa. Use villa=1 or villa=2." }, 400);
    }

    const calendarUrl = CALENDARS[villaId];
    if (!calendarUrl) {
      return json({ error: `Missing BOOKING_ICAL_VILLA_${villaId} secret` }, 500);
    }

    const [icsText, supabaseRows] = await Promise.all([
      fetchCalendar(calendarUrl),
      fetchSupabaseBookings(villaId),
    ]);

    const events = parseCalendarEvents(icsText);
    const bookingComBlockedDates = expandBookedDates(events);
    const supabaseBlockedDates = Array.from(expandSupabaseBlockedDates(supabaseRows));
    const blockedDates = Array.from(
      new Set([...bookingComBlockedDates, ...supabaseBlockedDates]),
    ).sort();

    return json({
      villa: villaId,
      blockedDates,
      sourceCounts: {
        bookingCom: bookingComBlockedDates.length,
        supabase: supabaseBlockedDates.length,
      },
    });
  } catch (error) {
    return json(
      { error: String(error instanceof Error ? error.message : error) },
      500,
    );
  }
});
