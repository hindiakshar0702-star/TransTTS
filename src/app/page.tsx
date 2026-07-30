"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./landing.css";

import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import BentoGrid from "@/components/landing/BentoGrid";
import StatsSection from "@/components/landing/StatsSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function HomePage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Authenticated users skip the landing page.
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => {
        if (r.ok) router.replace("/dashboard");
        else setIsChecking(false);
      })
      .catch(() => setIsChecking(false));
  }, [router]);

  if (isChecking) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "3px solid #e8e8e3", borderTopColor: "#0a0a0a",
          animation: "spin 0.8s linear infinite"
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="landing-page">
      <LandingNavbar />
      <HeroSection />
      <BentoGrid />
      <StatsSection />
      <TestimonialsSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
}
