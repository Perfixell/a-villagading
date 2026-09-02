import { Check, ExternalLink } from 'lucide-react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const BASE = import.meta.env.BASE_URL;

const villa1Highlights = [
  'Private Swimming Pool',
  'Spacious Bedrooms',
  'Bathtub',
  'Hot & Cold Water Dispenser',
  'Fast Wi-Fi',
  'Peaceful Rice Field Views Nearby',
  'Family Friendly',
  'Nearby Cafés & Restaurants',
  'Large Parking Area',
];

const villa2Highlights = [
  'Private Pool',
  'Comfortable Bedrooms',
  'Modern Amenities',
  'Peaceful Environment',
  'Family Friendly',
  'Close to Ubud Attractions',
];

interface VillaCardProps {
  villaId: 1 | 2;
  name: string;
  tagline: string;
  description: string;
  highlights: string[];
  image: string;
  accentImage: string;
  bookingUrl: string;
  bookLabel: string;
  delay?: string;
  onBook: (villaId: 1 | 2) => void;
}

function VillaCard({ villaId, name, tagline, description, highlights, image, accentImage, bookingUrl, bookLabel, onBook, delay = '' }: VillaCardProps) {
  return (
    <div className={`animate-on-scroll ${delay} bg-white rounded-3xl overflow-hidden shadow-luxury hover:shadow-luxury-md transition-all duration-500 group flex flex-col`}>
      {/* Image */}
      <div className="relative h-72 overflow-hidden">
        <img
          src={image}
          alt={`${name} - private villa in Ubud`}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-400/50 to-transparent" />
        <div className="absolute bottom-5 left-5">
          <span className="font-sans text-xs font-semibold tracking-widest uppercase text-gold-200 bg-charcoal-400/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
            Private Villa
          </span>
        </div>
        {/* Accent image - bathroom or secondary shot */}
        <div className="absolute top-4 right-4 w-20 h-20 rounded-xl overflow-hidden shadow-luxury border-2 border-white/30">
          <img src={accentImage} alt={`${name} interior`} className="w-full h-full object-cover" loading="lazy" />
        </div>
      </div>

      {/* Content */}
      <div className="p-8 flex flex-col flex-1">
        <p className="section-label mb-2">{tagline}</p>
        <h3 className="font-serif text-2xl font-semibold text-charcoal-300 mb-4">{name}</h3>
        <p className="font-sans text-sm text-charcoal-100 leading-relaxed mb-6 font-light">{description}</p>

        {/* Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-8">
          {highlights.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                <Check size={10} className="text-sage-400" />
              </div>
              <span className="font-sans text-xs text-charcoal-200">{item}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mt-auto">
          <button
            type="button"
            onClick={() => onBook(villaId)}
            className="btn-gold text-xs flex-1 justify-center"
          >
            {bookLabel}
          </button>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline-dark text-xs flex-1 justify-center gap-2"
          >
            Learn More <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Villas({ onBook }: { onBook: (villaId: 1 | 2) => void }) {
  const ref = useScrollAnimation();

  return (
    <section id="villas" className="py-24 md:py-32 bg-sand-100" ref={ref}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="section-label animate-on-scroll mb-4">Accommodations</p>
          <h2 className="section-title animate-on-scroll delay-100 mb-6">Our Villas</h2>
          <p className="section-subtitle animate-on-scroll delay-200">
            Two distinct private villas, each offering the same hallmarks of comfort, serenity, and genuine Balinese character.
          </p>
        </div>

        {/* Villa Cards */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10">
          <VillaCard
            villaId={1}
            name="Villa Gading"
            tagline="Original Estate"
            description="Villa Gading Mas Ubud is a peaceful retreat surrounded by lush rice fields and the cultural charm of Mas Village. Designed for travelers seeking relaxation without compromising on comfort, the villa features a private pool, spacious interiors, modern amenities, and warm Balinese hospitality. Located just minutes from Ubud's famous temples, rice terraces, cafés, restaurants, and art galleries."
            highlights={villa1Highlights}
            image={`${BASE}images/reviews/471908977.jpg`}
            accentImage={`${BASE}images/reviews/849064852.jpg`}
            bookingUrl="https://www.booking.com/hotel/id/villa-gading-kab-gianyar.id.html"
            bookLabel="Book Villa Gading"
            onBook={onBook}
            delay="delay-100"
          />
          <VillaCard
            villaId={2}
            name="Villa Gading 2"
            tagline="Sister Property"
            description="Villa Gading 2 offers the same peaceful atmosphere with elegant interiors, modern comforts, and easy access to everything Ubud has to offer. Designed for guests looking for privacy and relaxation, it provides an inviting tropical setting perfect for memorable holidays, family gatherings, and intimate retreats."
            highlights={villa2Highlights}
            image={`${BASE}images/reviews/849065921.jpg`}
            accentImage={`${BASE}images/reviews/471909276.jpg`}
            bookingUrl="https://www.booking.com/hotel/id/villa-gading2.html"
            bookLabel="Book Villa Gading 2"
            onBook={onBook}
            delay="delay-200"
          />
        </div>
      </div>
    </section>
  );
}
