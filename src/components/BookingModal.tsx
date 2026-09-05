import { useCallback, useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";

import { calculateBookingPrice } from "../services/pricing";
import { createBooking } from "../services/bookings";
import { getBlockedDates } from "../services/bookingCalendar";
import { createMidtransTransaction } from "../services/payments";
import TurnstileWidget from "./TurnstileWidget";

interface BookingModalProps {
  isOpen: boolean;
  initialVillaId?: 1 | 2;
  onClose: () => void;
  onOpenTerms: () => void;
}

type NightBreakdownItem = {
  date: string;
  price: number;
  label: string;
};

const MAX_GUESTS = 6;
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";

function todayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatLocalYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalYMD(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function nextDay(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + 1);
  return copy;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isDateRangeBlocked(start: string, end: string, blockedDates: string[]) {
  if (!start || !end) return false;

  const from = parseLocalYMD(start);
  const to = parseLocalYMD(end);

  for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
    const ymd = formatLocalYMD(d);
    if (blockedDates.includes(ymd)) return true;
  }

  return false;
}

export default function BookingModal({ isOpen, initialVillaId = 1, onClose, onOpenTerms }: BookingModalProps) {
  const initialVillaName = initialVillaId === 2 ? "Villa Gading 2" : "Villa Gading";
  const [villa, setVilla] = useState(initialVillaName);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [bookingReference, setBookingReference] = useState("");
  const [paymentToken, setPaymentToken] = useState("");
  const [bookingCreated, setBookingCreated] = useState(false);

  const [guestName, setGuestName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string>("");
  const [specialRequests, setSpecialRequests] = useState("");

  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [nightlyBreakdown, setNightlyBreakdown] = useState<NightBreakdownItem[]>(
    []
  );
  const [totalPrice, setTotalPrice] = useState(0);

  const [loadingBlockedDates, setLoadingBlockedDates] = useState(false);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startingPayment, setStartingPayment] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);

  const [emailError, setEmailError] = useState("");
  const [pricingError, setPricingError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const villaId: 1 | 2 = villa === "Villa Gading" ? 1 : 2;
  const nights = nightlyBreakdown.length;

  const resetForm = useCallback(() => {
    setBookingCreated(false);
    setBookingReference("");
    setPaymentToken("");
    setVilla(initialVillaName);
    setCheckIn("");
    setCheckOut("");
    setAdults(2);
    setChildren(0);
    setGuestName("");
    setEmail("");
    setPhone("");
    setSpecialRequests("");
    setNightlyBreakdown([]);
    setTotalPrice(0);
    setEmailError("");
    setPricingError("");
    setSubmitError("");
    setSubmitSuccess("");
    setPaymentError("");
    setAgreedToTerms(false);
    setTurnstileToken("");
  }, [initialVillaName]);

  function handleClose() {
    resetForm();
    onClose();
  }

  const today = useMemo(() => todayLocal(), []);
  const blockedDateSet = useMemo(() => new Set(blockedDates), [blockedDates]);
  const blockedDateObjects = useMemo(
    () => blockedDates.map((d) => parseLocalYMD(d)),
    [blockedDates]
  );
  const checkInDate = useMemo(
    () => (checkIn ? parseLocalYMD(checkIn) : null),
    [checkIn]
  );
  const checkOutDate = useMemo(
    () => (checkOut ? parseLocalYMD(checkOut) : null),
    [checkOut]
  );

  const isBlockedDay = (date: Date) => blockedDateSet.has(formatLocalYMD(date));

  const checkInDayClassName = (date: Date) =>
    isBlockedDay(date) ? "booking-day-blocked" : "";

  const isValidCheckInDate = (date: Date) => !isBlockedDay(date);

  const isValidCheckOutDate = (date: Date) => {
    if (isBlockedDay(date)) return false;
    if (!checkInDate) return date > today;
    if (date <= checkInDate) return false;

    const dateYmd = formatLocalYMD(date);
    return !isDateRangeBlocked(checkIn, dateYmd, blockedDates);
  };


useEffect(() => {
  if (!isOpen) {
    resetForm();
  } else if (!bookingCreated) {
    setVilla(initialVillaName);
  }
}, [isOpen, initialVillaName, bookingCreated, resetForm]);

  useEffect(() => {
    setPricingError("");
  }, [villaId, checkIn, checkOut]);

  useEffect(() => {
    let cancelled = false;

    async function loadBlockedDates() {
      if (!isOpen) return;

      setLoadingBlockedDates(true);

      try {
        const dates = await getBlockedDates(villaId);
        if (!cancelled) setBlockedDates(dates);
      } catch (err) {
        console.error(err);
        if (!cancelled) setBlockedDates([]);
      } finally {
        if (!cancelled) setLoadingBlockedDates(false);
      }
    }

    loadBlockedDates();

    return () => {
      cancelled = true;
    };
  }, [villaId, isOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadPricing() {
      if (!isOpen) return;

      if (!checkIn || !checkOut) {
        setNightlyBreakdown([]);
        setTotalPrice(0);
        setLoadingPricing(false);
        setPricingError("");
        return;
      }

      setLoadingPricing(true);

      try {
        const pricing = await calculateBookingPrice(villaId, checkIn, checkOut);
        if (!cancelled) {
          setTotalPrice(pricing.total);
          setNightlyBreakdown(pricing.nightlyBreakdown);
          setPricingError("");
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setTotalPrice(0);
          setNightlyBreakdown([]);
          setPricingError(
            err instanceof Error ? err.message : "Pricing is unavailable right now."
          );
        }
      } finally {
        if (!cancelled) setLoadingPricing(false);
      }
    }

    loadPricing();

    return () => {
      cancelled = true;
    };
  }, [villaId, checkIn, checkOut, isOpen]);

  useEffect(() => {
    setEmailError("");
  }, [email]);

  if (!isOpen) return null;





  const handleContinue = async () => {
    setSubmitError("");
    setSubmitSuccess("");
    setPaymentError("");

    if (loadingBlockedDates || loadingPricing) {
      setSubmitError(
        pricingError || "Please wait for availability and pricing to finish loading."
      );
      return;
    }

    if (!checkIn || !checkOut) {
      setSubmitError("Please select both check-in and check-out dates.");
      return;
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
      setSubmitError("Check-out must be after check-in.");
      return;
    }

    if (isDateRangeBlocked(checkIn, checkOut, blockedDates)) {
      setSubmitError("Those dates are unavailable. Please pick a different range.");
      return;
    }

    if (adults + children > MAX_GUESTS) {
      setSubmitError(`Maximum occupancy is ${MAX_GUESTS} guests.`);
      return;
    }

    if (!guestName.trim() || guestName.trim().length < 2) {
      setSubmitError("Please enter a valid full name.");
      return;
    }

    if (!email.trim()) {
      setEmailError("Please enter your email.");
      return;
    }

    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    if (!phone || !isValidPhoneNumber(phone)) {
      setSubmitError("Please enter a valid phone number.");
      return;
    }

    if (nights === 0) {
      setSubmitError(pricingError || "Price is still loading. Please wait a moment.");
      return;
    }

    if (!agreedToTerms) {
      setSubmitError("Please accept the Terms & Conditions to continue.");
      return;
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setSubmitError("Please complete the security check before continuing.");
      return;
    }

    setSaving(true);

    try {
      const booking = await createBooking({
        villa_id: villaId,
        guest_name: guestName.trim(),
        email: email.trim(),
        phone,
        adults,
        children,
        check_in: checkIn,
        check_out: checkOut,
        special_requests: specialRequests.trim() || undefined,
        turnstile_token: turnstileToken || undefined,
      });

      setBookingReference(booking.booking_reference);
      setPaymentToken(booking.payment_token);
      setTotalPrice(booking.total_price);

      setSubmitSuccess("Booking created. Continue to payment to confirm your stay.");
      setBookingCreated(true);
    } catch (err: unknown) {
      console.error("Booking Error:", err);
      setSubmitError(err instanceof Error ? err.message : "Failed to create booking.");
      if (TURNSTILE_SITE_KEY) {
        setTurnstileToken("");
        setTurnstileResetSignal((value) => value + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStartPayment = async () => {
    setPaymentError("");

    if (!bookingReference || !paymentToken) {
      setPaymentError("Missing secure payment details. Please create the booking again.");
      return;
    }

    setStartingPayment(true);

    try {
      const result = await createMidtransTransaction(bookingReference, paymentToken);

      if (result.status === "paid") {
        setSubmitSuccess("Payment already completed for this booking.");
        return;
      }

      if (!result.redirectUrl) {
        setPaymentError("Payment link not returned. Please try again.");
        return;
      }

      window.location.href = result.redirectUrl;
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : "Could not start payment. Please try again.");
    } finally {
      setStartingPayment(false);
    }
  };
if (bookingCreated) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-center font-serif text-3xl">
          Booking Created
        </h2>

        <p className="mb-6 text-center text-gray-600">
          Complete payment to confirm your stay.
        </p>

        {submitSuccess && (
          <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700" role="status" aria-live="polite">
            {submitSuccess}
          </p>
        )}

        {paymentError && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {paymentError}
          </p>
        )}

        <div className="space-y-3 rounded-2xl border bg-gray-50 p-5">
          <div className="flex justify-between">
            <span>Reference</span>
            <span className="font-medium">{bookingReference}</span>
          </div>
          <div className="flex justify-between">
            <span>Villa</span>
            <span className="font-medium">{villa}</span>
          </div>
          <div className="flex justify-between">
            <span>Check-in</span>
            <span className="font-medium">{checkIn}</span>
          </div>
          <div className="flex justify-between">
            <span>Check-out</span>
            <span className="font-medium">{checkOut}</span>
          </div>
          <div className="flex justify-between">
            <span>Total</span>
            <span className="font-medium">
              Rp {totalPrice.toLocaleString("id-ID")}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={handleClose}
            className="w-full rounded-xl border border-gray-300 bg-white py-3 text-gray-800 transition hover:bg-gray-50"
            disabled={startingPayment}
          >
            Close
          </button>

          <button
            onClick={handleStartPayment}
            className="w-full rounded-xl bg-black py-3 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={startingPayment}
          >
            {startingPayment ? "Preparing payment..." : "Pay Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-8 text-center font-serif text-3xl">Book Your Stay</h2>

        <div className="mb-6 min-h-[52px]" aria-live="polite">
          {submitError ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {submitError}
            </p>
          ) : submitSuccess ? (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
              {submitSuccess}
            </p>
          ) : null}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block font-medium">Villa</label>
            <select
              value={villa}
              onChange={(e) => setVilla(e.target.value)}
              className="w-full rounded-xl border p-3"
              disabled={saving}
            >
              <option>Villa Gading</option>
              <option>Villa Gading 2</option>
            </select>
          </div>

          <div>
  <label id="check-in-label" className="mb-2 block font-medium">Check-in</label>
  <DatePicker
    selected={checkInDate}
    onChange={(date: Date | null) => {
      if (!date) return;
      const ymd = formatLocalYMD(date);
      setCheckIn(ymd);
      if (checkOutDate && checkOutDate <= date) setCheckOut("");
    }}
    minDate={today}
    filterDate={isValidCheckInDate}
    excludeDates={blockedDateObjects}
    dayClassName={checkInDayClassName}
    calendarClassName="booking-datepicker"
    dateFormat="dd MMM yyyy"
    placeholderText="Select check-in"
    className="w-full rounded-xl border p-3"
    disabled={saving}
  />
  {loadingBlockedDates && (
    <div className="mt-2 h-4 w-2/3 rounded bg-gray-200 skeleton" aria-hidden="true" />
  )}
</div>

          <div>
  <label id="check-out-label" className="mb-2 block font-medium">Check-out</label>
  <DatePicker
    selected={checkOutDate}
    onChange={(date: Date | null) => {
      if (!date) return;
      setCheckOut(formatLocalYMD(date));
    }}
    minDate={checkInDate ? nextDay(checkInDate) : nextDay(today)}
    filterDate={isValidCheckOutDate}
    excludeDates={blockedDateObjects}
    calendarClassName="booking-datepicker"
    dateFormat="dd MMM yyyy"
    placeholderText="Select check-out"
    className="w-full rounded-xl border p-3"
    disabled={saving}
  />
  {loadingBlockedDates && (
    <div className="mt-2 h-4 w-2/3 rounded bg-gray-200 skeleton" aria-hidden="true" />
  )}
</div>

          <div>
            <label className="mb-2 block font-medium">Adults</label>
            <select
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className="w-full rounded-xl border p-3"
              disabled={saving}
            >
              {Array.from({ length: MAX_GUESTS }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block font-medium">Children</label>
            <select
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
              className="w-full rounded-xl border p-3"
              disabled={saving}
            >
              {Array.from({ length: MAX_GUESTS + 1 }, (_, index) => index).map((count) => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block font-medium">Full Name</label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full rounded-xl border p-3"
              placeholder="Your full name"
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
              }}
              className="w-full rounded-xl border p-3"
              placeholder="you@example.com"
              disabled={saving}
            />
            {emailError && (
              <p className="mt-2 text-sm text-red-600">{emailError}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block font-medium">Phone Number</label>
            <div className="rounded-xl border p-3">
              <PhoneInput
                international
                defaultCountry="ID"
                value={phone || undefined}
                onChange={(value) => setPhone(value ?? "")}
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block font-medium">Special Requests</label>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              className="w-full rounded-xl border p-3"
              rows={4}
              placeholder="Optional"
              disabled={saving}
            />
          </div>

          <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <label className="flex items-start gap-3 text-sm leading-6 text-charcoal-200">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                disabled={saving || startingPayment}
              />
              <span>
                I have read and agree to the Terms & Conditions.
              </span>
            </label>
            <button
              type="button"
              onClick={onOpenTerms}
              className="mt-3 text-sm font-medium text-black underline underline-offset-4"
            >
              View Terms & Conditions
            </button>
          </div>

          {TURNSTILE_SITE_KEY && (
            <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-white p-4">
              <p className="mb-3 text-sm font-medium text-charcoal-200">Security check</p>
              <TurnstileWidget
                siteKey={TURNSTILE_SITE_KEY}
                onTokenChange={setTurnstileToken}
                resetSignal={turnstileResetSignal}
              />
            </div>
          )}
        </div>

        {loadingPricing && checkIn && checkOut && (
          <div className="mt-6 mb-6 rounded-2xl border bg-gray-50 p-5" aria-hidden="true">
            <div className="mb-4 h-6 w-40 rounded bg-gray-200 skeleton" />
            <div className="space-y-3">
              <div className="h-4 w-full rounded bg-gray-200 skeleton" />
              <div className="h-4 w-5/6 rounded bg-gray-200 skeleton" />
              <div className="h-4 w-4/5 rounded bg-gray-200 skeleton" />
            </div>
          </div>
        )}

        {pricingError && !loadingPricing && checkIn && checkOut && (
          <div className="mt-6 mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {pricingError}
          </div>
        )}

        {nights > 0 && !loadingPricing && (
          <div className="mt-6 mb-6 rounded-2xl border bg-gray-50 p-5">
            <h3 className="mb-4 text-xl font-semibold">Booking Summary</h3>

            <div className="mb-2 flex justify-between">
              <span>Villa</span>
              <span>{villa}</span>
            </div>

            <div className="mb-2 flex justify-between">
              <span>Nights</span>
              <span>{nights}</span>
            </div>

            <div className="space-y-2 mb-4">
              {nightlyBreakdown.map((night) => (
                <div key={night.date} className="flex justify-between text-sm">
                  <div>
                    <div>{night.date}</div>
                    <div className="text-gray-500">{night.label}</div>
                  </div>
                  <span>Rp {night.price.toLocaleString("id-ID")}</span>
                </div>
              ))}
            </div>

            <hr className="my-4" />

            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>Rp {totalPrice.toLocaleString("id-ID")}</span>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={handleClose}
            className="w-full rounded-xl border border-gray-300 bg-white py-3 text-gray-800 transition hover:bg-gray-50"
          >
            Close
          </button>

          <button
            onClick={handleContinue}
            disabled={saving || loadingPricing || loadingBlockedDates || !agreedToTerms || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
            className="w-full rounded-xl bg-black py-3 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Creating Booking..."
              : loadingPricing || loadingBlockedDates
              ? "Loading..."
              : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
