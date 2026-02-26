
import HeroSection from "@/components/landingpage/HeroSection";
import FeaturesSection from "@/components/landingpage/FeaturesSection";
import IntegrationsSection from "@/components/landingpage/IntegrationsSection";
import HowItWorksSection from "@/components/landingpage/HowItWorksSection";
import StatsSection from "@/components/landingpage/StatsSection";
import MoreFeaturesSection from "@/components/landingpage/MoreFeaturesSection";
import CTASection from "@/components/landingpage/CTASection";
import Footer from "@/components/landingpage/Footer";

export default function Home() {
  return (

    <div className="min-h-screen bg-[#161925]">

      <HeroSection />
      <FeaturesSection />
      <IntegrationsSection />
      <HowItWorksSection />
      <StatsSection />
      <MoreFeaturesSection />
      <CTASection />
      <Footer />
    </div>
  );
}
