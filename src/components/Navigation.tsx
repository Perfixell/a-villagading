import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Villas', href: '#villas' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Reviews', href: '#reviews' },
  { label: 'Location', href: '#location' },
];

interface NavigationProps {
  onBook: (villaId?: 1 | 2) => void;
}

export default function Navigation({ onBook }: NavigationProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
          scrolled
            ? 'bg-cream-100/95 backdrop-blur-md shadow-luxury border-b border-sand-200'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <a
              href="#home"
              onClick={(e) => { e.preventDefault(); handleNavClick('#home'); }}
              className="flex flex-col"
            >
              <span
                className={`font-serif text-xl font-semibold leading-tight transition-colors duration-300 ${
                  scrolled ? 'text-charcoal-300' : 'text-white'
                }`}
              >
                Villa Gading
              </span>
              <span
                className={`font-sans text-xs tracking-[0.18em] uppercase transition-colors duration-300 ${
                  scrolled ? 'text-gold-300' : 'text-gold-200'
                }`}
              >
                Ubud, Bali
              </span>
            </a>

            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
                  className={`font-sans text-sm font-medium tracking-wide transition-colors duration-300 hover:text-gold-300 ${
                    scrolled ? 'text-charcoal-200' : 'text-white/90'
                  }`}
                >
                  {link.label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => onBook()}
                className="btn-gold text-xs px-6 py-2.5"
              >
                Book Now
              </button>
            </div>

            <button
              className={`md:hidden p-2 transition-colors duration-300 ${
                scrolled ? 'text-charcoal-300' : 'text-white'
              }`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="absolute inset-0 bg-charcoal-400/60 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />
        <div
          className={`absolute top-0 right-0 bottom-0 w-72 bg-cream-100 shadow-luxury-lg transition-transform duration-300 ${
            menuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full pt-24 pb-10 px-8">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
                  className="font-sans text-base font-medium text-charcoal-200 py-3 border-b border-sand-200 hover:text-gold-300 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <button
                type="button"
                className="btn-gold text-center text-sm"
                onClick={() => { setMenuOpen(false); onBook(1); }}
              >
                Book Villa Gading
              </button>
              <button
                type="button"
                className="btn-outline-dark text-center text-sm"
                onClick={() => { setMenuOpen(false); onBook(2); }}
              >
                Book Villa Gading 2
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
