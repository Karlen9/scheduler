'use client';

import { ChevronDown, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { TopBar } from '@/components/TopBar';
import { useSubscription } from '@/hooks/queries';
import { openTelegramUserChat } from '@/lib/telegram';

import type { TFAQItem } from '@/lib/types';
import type { ReactNode } from 'react';

function FAQAccordion({ item }: { item: TFAQItem }): ReactNode {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={'border-border border-b'}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={'flex w-full items-center justify-between py-4 text-left'}
      >
        <span className={'text-foreground pr-4'}>{item.question}</span>
        <ChevronDown
          className={`text-muted-foreground h-5 w-5 flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && <div className={'text-muted-foreground pb-4 text-sm'}>{item.answer}</div>}
    </div>
  );
}

export default function HelpPage(): ReactNode {
  const t = useTranslations('AdminHelp');
  const { data } = useSubscription();

  const faqItems: TFAQItem[] = [
    { question: t('faq_q1'), answer: t('faq_a1') },
    { question: t('faq_q2'), answer: t('faq_a2') },
    { question: t('faq_q11'), answer: t('faq_a11') },
    { question: t('faq_q3'), answer: t('faq_a3') },
    { question: t('faq_q4'), answer: t('faq_a4') },
    { question: t('faq_q5'), answer: t('faq_a5') },
    { question: t('faq_q6'), answer: t('faq_a6') },
    { question: t('faq_q7'), answer: t('faq_a7') },
    { question: t('faq_q8'), answer: t('faq_a8') },
    { question: t('faq_q9'), answer: t('faq_a9') },
    { question: t('faq_q10'), answer: t('faq_a10') },
  ];

  const handleContactSupport = (): void => {
    openTelegramUserChat(data?.masterBotUsername);
  };

  return (
    <div>
      <TopBar title={t('title')} showBack />
      <div className={'space-y-6 p-4'}>
        <div>
          <h3 className={'text-muted-foreground mb-3 text-sm font-medium'}>{t('faqTitle')}</h3>
          <div className={'bg-card rounded-xl px-4'}>
            {faqItems.map((item, index) => (
              <FAQAccordion key={index} item={item} />
            ))}
          </div>
        </div>
        <div>
          <h3 className={'text-muted-foreground mb-3 text-sm font-medium'}>{t('needHelp')}</h3>
          <button
            onClick={handleContactSupport}
            className={
              'bg-brand flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-white transition-opacity active:opacity-80'
            }
          >
            <MessageCircle className={'h-5 w-5'} />
            <span>{t('contactSupport')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
