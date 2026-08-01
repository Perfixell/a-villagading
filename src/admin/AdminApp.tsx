import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarDays, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  AdminBooking,
  AdminPricingPeriod,
  getAdminBookings,
  getAdminPricing,
  isCurrentUserAdmin,
  savePricingPeriod,
  updateBookingStatus,
} from "../services/admin";

const emptyPrice: Omit<AdminPricingPeriod, "id"> = {
  villa_id: 1,
  label: "",
  start_date: "",
  end_date: "",
  nightly_price: 0,
  minimum_stay: 1,
  active: true,
};

function Login({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }
    await onAuthenticated();
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-950 px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <ShieldCheck className="mx-auto mb-4 h-10 w-10" />
        <h1 className="text-center font-serif text-3xl">Villa Gading Admin</h1>
        <p className="mb-2 mt-2 text-center text-sm text-gray-500">Sign in with an authorized administrator account.</p>
        <p className="mb-7 text-center text-xs text-gray-400">Use the password created for this admin account in Supabase, not your Gmail password.</p>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <label className="mb-2 block text-sm font-medium">Email</label>
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="mb-4 w-full rounded-xl border p-3" />
        <label className="mb-2 block text-sm font-medium">Password</label>
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mb-6 w-full rounded-xl border p-3" />
        <button disabled={loading} className="w-full rounded-xl bg-black py-3 text-white disabled:opacity-50">{loading ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}

export default function AdminApp() {
  const [state, setState] = useState<"checking" | "signed-out" | "forbidden" | "ready">("checking");
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [pricing, setPricing] = useState<AdminPricingPeriod[]>([]);
  const [draft, setDraft] = useState<Omit<AdminPricingPeriod, "id"> & { id?: number }>(emptyPrice);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadDashboard = useCallback(async () => {
    setError("");
    try {
      const [nextBookings, nextPricing] = await Promise.all([getAdminBookings(), getAdminPricing()]);
      setBookings(nextBookings);
      setPricing(nextPricing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the dashboard.");
    }
  }, []);

  const checkAccess = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setState("signed-out");
      return;
    }
    try {
      const allowed = await isCurrentUserAdmin();
      setState(allowed ? "ready" : "forbidden");
      if (allowed) await loadDashboard();
    } catch {
      setState("forbidden");
    }
  }, [loadDashboard]);

  useEffect(() => { void checkAccess(); }, [checkAccess]);

  async function changeStatus(id: string, status: string) {
    try {
      await updateBookingStatus(id, status);
      setBookings((rows) => rows.map((row) => row.id === id ? { ...row, booking_status: status } : row));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update booking.");
    }
  }

  async function savePrice(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await savePricingPeriod(draft);
      setDraft(emptyPrice);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save pricing.");
    } finally {
      setSaving(false);
    }
  }

  if (state === "checking") return <div className="flex min-h-screen items-center justify-center">Checking access...</div>;
  if (state === "signed-out") return <Login onAuthenticated={checkAccess} />;
  if (state === "forbidden") return <main className="flex min-h-screen items-center justify-center bg-stone-950 p-4"><div className="rounded-3xl bg-white p-8 text-center"><h1 className="text-2xl font-semibold">Access denied</h1><p className="mt-2 text-gray-600">This account is not an administrator.</p><button onClick={() => supabase.auth.signOut({ scope: "local" }).then(() => setState("signed-out"))} className="mt-6 rounded-xl bg-black px-5 py-3 text-white">Sign out</button></div></main>;

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div><h1 className="font-serif text-2xl">Villa Gading Admin</h1><p className="text-xs text-gray-500">Bookings and pricing</p></div><div className="flex gap-2"><button onClick={() => void loadDashboard()} aria-label="Refresh" className="rounded-xl border p-2"><RefreshCw className="h-5 w-5" /></button><button onClick={() => supabase.auth.signOut({ scope: "local" }).then(() => setState("signed-out"))} className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-white"><LogOut className="h-4 w-4" /> Sign out</button></div></div></header>
      <main className="mx-auto max-w-7xl space-y-8 p-5">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
        <section><h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><CalendarDays className="h-5 w-5" /> Bookings</h2><div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-stone-50"><tr>{["Reference", "Guest", "Stay", "Villa", "Total", "Payment", "Status"].map((h) => <th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id} className="border-t"><td className="p-4 font-medium">{booking.booking_reference}</td><td className="p-4"><div>{booking.guest_name}</div><div className="text-xs text-gray-500">{booking.email}<br />{booking.phone}</div></td><td className="p-4">{booking.check_in}<br />{booking.check_out}</td><td className="p-4">{booking.villa_id}</td><td className="p-4">Rp {booking.total_price.toLocaleString("id-ID")}</td><td className="p-4">{booking.payment_status}</td><td className="p-4"><select value={booking.booking_status} onChange={(e) => void changeStatus(booking.id, e.target.value)} className="rounded-lg border p-2"><option value="pending_payment">Pending payment</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="completed">Completed</option></select></td></tr>)}</tbody></table>{bookings.length === 0 && <p className="p-6 text-center text-gray-500">No bookings found.</p>}</div></section>
        <section><h2 className="mb-4 text-xl font-semibold">Pricing periods</h2><div className="grid gap-5 lg:grid-cols-[1fr_380px]"><div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-stone-50"><tr>{["Villa", "Label", "Dates", "Nightly price", "Minimum", "Active"].map((h) => <th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{pricing.map((price) => <tr key={price.id} onClick={() => setDraft(price)} className="cursor-pointer border-t hover:bg-stone-50"><td className="p-4">{price.villa_id}</td><td className="p-4">{price.label}</td><td className="p-4">{price.start_date} – {price.end_date}</td><td className="p-4">Rp {price.nightly_price.toLocaleString("id-ID")}</td><td className="p-4">{price.minimum_stay} night(s)</td><td className="p-4">{price.active ? "Yes" : "No"}</td></tr>)}</tbody></table></div><form onSubmit={savePrice} className="rounded-2xl border bg-white p-5"><h3 className="mb-4 font-semibold">{draft.id ? "Edit pricing" : "Add pricing"}</h3><label className="mb-1 block text-sm">Villa</label><select value={draft.villa_id} onChange={(e) => setDraft({ ...draft, villa_id: Number(e.target.value) })} className="mb-3 w-full rounded-lg border p-2"><option value={1}>Villa Gading</option><option value={2}>Villa Gading 2</option></select><label className="mb-1 block text-sm">Label</label><input required value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="mb-3 w-full rounded-lg border p-2" /><div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-sm">Start</label><input type="date" required value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} className="mb-3 w-full rounded-lg border p-2" /></div><div><label className="mb-1 block text-sm">End</label><input type="date" required value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} className="mb-3 w-full rounded-lg border p-2" /></div></div><label className="mb-1 block text-sm">Nightly price (IDR)</label><input type="number" min="1" required value={draft.nightly_price} onChange={(e) => setDraft({ ...draft, nightly_price: Number(e.target.value) })} className="mb-3 w-full rounded-lg border p-2" /><label className="mb-1 block text-sm">Minimum stay</label><input type="number" min="1" required value={draft.minimum_stay} onChange={(e) => setDraft({ ...draft, minimum_stay: Number(e.target.value) })} className="mb-3 w-full rounded-lg border p-2" /><label className="mb-4 flex gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active</label><div className="flex gap-2"><button disabled={saving} className="flex-1 rounded-lg bg-black p-3 text-white disabled:opacity-50">{saving ? "Saving..." : "Save"}</button><button type="button" onClick={() => setDraft(emptyPrice)} className="rounded-lg border px-4">New</button></div></form></div></section>
      </main>
    </div>
  );
}
