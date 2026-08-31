export async function createBooking(data: {
  villa_id: number;
  guest_name: string;
  email: string;
  phone: string;
  adults: number;
  children: number;
  check_in: string;
  check_out: string;
  special_requests?: string;
  turnstile_token?: string;
}) {
  const res = await fetch(
    "https://qbjyjkeflhkepprtlfiq.functions.supabase.co/booking-create",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  const payload = (await res.json()) as {
    error?: string;
    booking_reference?: string;
    total_price?: number;
    payment_token?: string;
  };

  if (!res.ok) {
    throw new Error(
      payload.error || "Failed to create booking. Please try again."
    );
  }

  if (!payload.booking_reference || typeof payload.total_price !== "number" || !payload.payment_token) {
    throw new Error("The booking server returned an invalid response.");
  }

  return {
    booking_reference: payload.booking_reference,
    total_price: payload.total_price,
    payment_token: payload.payment_token,
  };
}
