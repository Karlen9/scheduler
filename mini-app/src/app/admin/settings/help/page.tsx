"use client";

import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { TopBar } from "@/components/TopBar";

interface FAQItem {
  question: string;
  answer: string;
}

function FAQAccordion({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <span className="text-foreground pr-4">{item.question}</span>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="pb-4 text-sm text-muted-foreground">
          {item.answer}
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const t = useTranslations("AdminHelp");

  const faqItems: FAQItem[] = [
    { question: t("faq_q1"), answer: t("faq_a1") },
    { question: t("faq_q2"), answer: t("faq_a2") },
    { question: t("faq_q3"), answer: t("faq_a3") },
    { question: t("faq_q4"), answer: t("faq_a4") },
    { question: t("faq_q5"), answer: t("faq_a5") },
  ];

  const handleContactSupport = () => {
    window.open("https://t.me/support", "_blank");
  };

  return (
    <div>
      <TopBar title={t("title")} showBack />

      <div className="p-4 space-y-6">
        {/* FAQ Section */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {t("faqTitle")}
          </h3>
          <div className="bg-card rounded-xl px-4">
            {faqItems.map((item, index) => (
              <FAQAccordion key={index} item={item} />
            ))}
          </div>
        </div>

        {/* Contact Support */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {t("needHelp")}
          </h3>
          <button
            onClick={handleContactSupport}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand text-white font-medium transition-opacity active:opacity-80"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{t("contactSupport")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
