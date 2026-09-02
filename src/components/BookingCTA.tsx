import { useScrollAnimation } from '../hooks/useScrollAnimation';

const BASE = import.meta.env.BASE_URL;

export default function BookingCTA({ onBook }: { onBook: (villaId: 1 | 2) => void }) {
  const ref = useScrollAnimation();

  return (
    <section className="relative py-28 md:py-40 overflow-hidden" ref={ref}>
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={`${BASE}images/reviews/849065921.jpg`}
          alt="Villa Gading tropical pool"
          className="w-full h-full object-cover object-center"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-charcoal-400/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal-400/80 via-charcoal-400/60 to-charcoal-400/80" />
      </div>

      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-40 h-40 rounded-full border border-white/10 opacity-50" />
      <div className="absolute bottom-10 right-10 w-60 h-60 rounded-full border border-white/10 opacity-30" />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <p className="animate-on-scroll section-label text-gold-200 mb-4">Reserve Your Stay</p>
        <h2 className="animate-on-scroll delay-100 font-serif text-4xl md:text-5xl lg:text-6xl font-normal text-white leading-tight text-shadow-lg mb-6">
          Your Ubud Getaway<br />
          <em className="font-light text-sand-200">Begins Here</em>
        </h2>
        <div className="w-12 h-0.5 bg-gold-300 mx-auto mb-8 animate-on-scroll delay-200" />
        <p className="animate-on-scroll delay-200 font-sans text-base md:text-lg text-white/75 leading-relaxed max-w-2xl mx-auto mb-12 font-light">
          Reserve your preferred villa today and enjoy an unforgettable stay surrounded by nature,
          comfort, and authentic Balinese hospitality.
        </p>

        <div className="animate-on-scroll delay-300 flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={() => onBook(1)}
            className="btn-gold text-sm px-10 py-4"
          >
            Book Villa Gading
          </button>
          <button
            type="button"
            onClick={() => onBook(2)}
            className="btn-outline text-sm px-10 py-4"
          >
            Book Villa Gading 2
          </button>
        </div>

        {/* Trust signals */}
        <div className="animate-on-scroll delay-400 mt-12 flex flex-col sm:flex-row items-center justify-center gap-8 text-white/50">
          <div className="flex items-center gap-2">
            <span className="text-gold-300">★★★★</span>
            <span className="font-sans text-xs">4.4 / 5 Rating</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-white/20" />
          <span className="font-sans text-xs">21 Guest Reviews</span>
          <div className="hidden sm:block w-px h-4 bg-white/20" />
          <span className="font-sans text-xs">Verified on Booking.com</span>
        </div>
      </div>
    </section>
  );
}
