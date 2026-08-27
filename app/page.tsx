import { AIConversation } from "@/components/landing/AIConversation";
import { CareerJourney } from "@/components/landing/CareerJourney";
import { FeatureCards } from "@/components/landing/FeatureCards";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";
import { FriendlyAISection } from "@/components/landing/FriendlyAISection";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { JobMatchPreview } from "@/components/landing/JobMatchPreview";
import { LanguageSection } from "@/components/landing/LanguageSection";
import { Navbar } from "@/components/landing/Navbar";
import { PortfolioPreview } from "@/components/landing/PortfolioPreview";
import { SriLankaSection } from "@/components/landing/SriLankaSection";
import { getOptionalUser } from "@/lib/auth/require-user";

export default async function Home() {
  const user = await getOptionalUser();
  const isAuthenticated = Boolean(user);

  return (
    <>
      <Navbar isAuthenticated={isAuthenticated} />
      <main className="flex flex-1 flex-col">
        <Hero isAuthenticated={isAuthenticated} />
        <AIConversation />
        <LanguageSection />
        <FeatureCards />
        <HowItWorks />
        <SriLankaSection />
        <JobMatchPreview />
        <CareerJourney />
        <PortfolioPreview />
        <FriendlyAISection />
        <FinalCTA isAuthenticated={isAuthenticated} />
      </main>
      <Footer />
    </>
  );
}
