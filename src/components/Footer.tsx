import { MapPin, Phone, Instagram, Facebook } from 'lucide-react';

const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Villas', href: '#villas' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Reviews', href: '#reviews' },
  { label: 'Location', href: '#location' },
];

interface FooterProps {
  onOpenTerms: () => void;
  onBook: (villaId: 1 | 2) => void;
}

function WhatsAppIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function Footer({ onOpenTerms, onBook }: FooterProps) {
  const handleNavClick = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="bg-charcoal-300 text-white">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="mb-6">
              <h3 className="font-serif text-2xl font-semibold text-white mb-1">Villa Gading</h3>
              <p className="font-sans text-xs tracking-[0.18em] uppercase text-gold-300">Ubud, Bali</p>
            </div>
            <p className="font-sans text-sm text-white/60 leading-relaxed font-light mb-6">
              Two private villas offering refined Balinese living, exceptional comfort, and genuine hospitality in the heart of Ubud.
            </p>
            {/* Social icons */}
            <div className="flex gap-3">
              <a
                href="https://www.instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-gold-300 flex items-center justify-center transition-colors duration-300"
                aria-label="Instagram"
              >
                <Instagram size={16} />
              </a>
              <a
                href="https://wa.me/6208993176567"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-gold-300 flex items-center justify-center transition-colors duration-300"
                aria-label="WhatsApp"
              >
                <WhatsAppIcon size={16} />
              </a>
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-gold-300 flex items-center justify-center transition-colors duration-300"
                aria-label="Facebook"
              >
                <Facebook size={16} />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-sans text-xs font-semibold tracking-[0.18em] uppercase text-gold-300 mb-5">Navigation</h4>
            <ul className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
                    className="font-sans text-sm text-white/60 hover:text-white transition-colors duration-300"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={onOpenTerms}
                  className="font-sans text-sm text-white/60 hover:text-white transition-colors duration-300"
                >
                  Terms & Conditions
                </button>
              </li>
            </ul>
          </div>

          {/* Our Villas */}
          <div>
            <h4 className="font-sans text-xs font-semibold tracking-[0.18em] uppercase text-gold-300 mb-5">Our Villas</h4>
            <ul className="flex flex-col gap-4">
              <li>
                <p className="font-sans text-sm font-medium text-white/80 mb-1">Villa Gading</p>
                <button
                  type="button"
                  onClick={() => onBook(1)}
                  className="inline-flex items-center gap-1.5 font-sans text-xs text-white/50 hover:text-gold-300 transition-colors duration-300"
                >
                  Book this villa
                </button>
              </li>
              <li>
                <p className="font-sans text-sm font-medium text-white/80 mb-1">Villa Gading 2</p>
                <button
                  type="button"
                  onClick={() => onBook(2)}
                  className="inline-flex items-center gap-1.5 font-sans text-xs text-white/50 hover:text-gold-300 transition-colors duration-300"
                >
                  Book this villa
                </button>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-sans text-xs font-semibold tracking-[0.18em] uppercase text-gold-300 mb-5">Contact</h4>
            <ul className="flex flex-col gap-4">
              <li className="flex gap-3">
                <MapPin size={16} className="text-gold-300 flex-shrink-0 mt-0.5" />
                <span className="font-sans text-sm text-white/60 leading-relaxed">
                  Jalan Cempaka, Mas<br />Gianyar, Bali 80571
                </span>
              </li>
              <li className="flex gap-3">
                <Phone size={16} className="text-gold-300 flex-shrink-0 mt-0.5" />
                <a
                  href="tel:+6208993176567"
                  className="font-sans text-sm text-white/60 hover:text-white transition-colors"
                >
                  0899-3176-567
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-sans text-xs text-white/40 text-center sm:text-left">
            &copy; {new Date().getFullYear()} Villa Gading Ubud. All rights reserved.
          </p>
          <p className="font-sans text-xs text-white/30">
            Jalan Cempaka, Mas, Gianyar, Bali 80571
          </p>
        </div>
      </div>
    </footer>
  );
}
