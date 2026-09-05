import { useState } from "react";
import BookingModal from "./components/BookingModal";


import Navigation from './components/Navigation';
import Hero from './components/Hero';
import About from './components/About';
import Villas from './components/Villas';
import Gallery from './components/Gallery';
import Reviews from './components/Reviews';
import WhyChoose from './components/WhyChoose';
import Location from './components/Location';
import BookingCTA from './components/BookingCTA';
import Footer from './components/Footer';
import BackToTop from './components/BackToTop';
import TermsModal from './components/TermsModal';

export default function App() {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingVillaId, setBookingVillaId] = useState<1 | 2>(1);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  const openBooking = (villaId: 1 | 2 = 1) => {
    setBookingVillaId(villaId);
    setIsBookingOpen(true);
  };

return (
    <div className="min-h-screen bg-cream-100 font-sans">
      <Navigation onBook={openBooking} />
      <main>
        <Hero onBook={() => openBooking()} />
        <About />
        <Villas onBook={openBooking} />
        <Gallery />
        <WhyChoose />
        <Reviews />
        <Location />
        <BookingCTA onBook={openBooking} />
      </main>

      <Footer onOpenTerms={() => setIsTermsOpen(true)} onBook={openBooking} />
      <BackToTop />

      <BookingModal
        isOpen={isBookingOpen}
        initialVillaId={bookingVillaId}
        onClose={() => setIsBookingOpen(false)}
        onOpenTerms={() => setIsTermsOpen(true)}
      />

      <TermsModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />
    </div>
);
}
