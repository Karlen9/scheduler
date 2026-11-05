import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';

import { AudienceSection } from '@/components/AudienceSection';
import { ClosingCtaSection } from '@/components/ClosingCtaSection';
import { ComparisonSection } from '@/components/ComparisonSection';
import { FaqSection } from '@/components/FaqSection';
import { FeaturesSection } from '@/components/FeaturesSection';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { HowItWorksSection } from '@/components/HowItWorksSection';
import { MobileCta } from '@/components/MobileCta';
import { PageMotion } from '@/components/PageMotion';
import { PainSection } from '@/components/PainSection';
import { PricingSection } from '@/components/PricingSection';
import { ReferralSection } from '@/components/ReferralSection';
import { SupportSection } from '@/components/SupportSection';
import { routing } from '@/i18n/routing';
import { MASTER_BOT_URL } from '@/lib/site';

import type { ReactNode } from 'react';

export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map((locale) => ({ locale }));
}

export default function HomePage({ params }: { params: Promise<{ locale: string }> }): ReactNode {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations();

  return (
    <>
      <a
        href={'#content'}
        className={
          'bg-primary text-primary-foreground sr-only z-[60] rounded-full px-5 py-3 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3'
        }
      >
        {t('a11y.skip')}
      </a>
      <Header />
      <main id={'content'}>
        <HeroSection />
        <PainSection />
        <FeaturesSection />
        <AudienceSection />
        <HowItWorksSection />
        <ComparisonSection />
        <PricingSection />
        <ReferralSection />
        <FaqSection />
        <SupportSection />
        <ClosingCtaSection />
      </main>
      <Footer />
      <MobileCta label={t('cta.primary')} href={MASTER_BOT_URL} />
      <PageMotion />
    </>
  );
}
