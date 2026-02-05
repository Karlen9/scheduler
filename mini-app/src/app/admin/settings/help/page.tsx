"use client";

import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { TopBar } from "@/components/TopBar";

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "Как добавить новую услугу?",
    answer:
      "Перейдите в Настройки → Услуги и цены → нажмите «Добавить услугу». Заполните название, цену и длительность.",
  },
  {
    question: "Как изменить рабочие часы?",
    answer:
      "Перейдите в Настройки → Расписание. Выберите время начала и окончания рабочего дня.",
  },
  {
    question: "Как отменить запись клиента?",
    answer:
      "На главном экране нажмите на запись, затем нажмите «Отменить». Клиент получит уведомление об отмене.",
  },
  {
    question: "Как перенести запись?",
    answer:
      "Нажмите на запись, затем «Изменить». Выберите новую дату и время. Клиент получит уведомление о переносе.",
  },
  {
    question: "Почему клиент не может отменить запись?",
    answer:
      "Если включена блокировка отмены, клиент не сможет отменить запись за указанное количество часов до начала. Настроить это можно в Настройки → Расписание.",
  },
];

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
  const handleContactSupport = () => {
    window.open("https://t.me/support", "_blank");
  };

  return (
    <div>
      <TopBar title="Помощь" showBack />

      <div className="p-4 space-y-6">
        {/* FAQ Section */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Частые вопросы
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
            Нужна помощь?
          </h3>
          <button
            onClick={handleContactSupport}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand text-white font-medium transition-opacity active:opacity-80"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Написать в поддержку</span>
          </button>
        </div>
      </div>
    </div>
  );
}
