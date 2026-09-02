const FUNCTIONS_BASE = "https://qbjyjkeflhkepprtlfiq.functions.supabase.co";

export type MidtransTransactionResponse = {
  status: "pending" | "paid";
  token?: string;
  redirectUrl?: string;
  orderId?: string;
  message?: string;
};

export async function createMidtransTransaction(bookingReference: string, paymentToken: string) {
  const res = await fetch(`${FUNCTIONS_BASE}/midtrans-create-transaction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bookingReference, paymentToken }),
  });

  const data = (await res.json()) as MidtransTransactionResponse & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || "Failed to create Midtrans transaction.");
  }

  return data;
}
