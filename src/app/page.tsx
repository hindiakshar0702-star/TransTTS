"use client";
import "./landing.css";

import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import BentoGrid from "@/components/landing/BentoGrid";
import StatsSection from "@/components/landing/StatsSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import CTASection from "@/components/landing/CTASection";
import SeoContent from "@/components/landing/SeoContent";
import LandingFooter from "@/components/landing/LandingFooter";

export default function HomePage() {
  return (
    <div className="landing-page">
      <LandingNavbar />
      <HeroSection />
      <BentoGrid />
      <StatsSection />
      <TestimonialsSection />
      <SeoContent />
      <CTASection />
      <LandingFooter />
    </div>
  );
}
