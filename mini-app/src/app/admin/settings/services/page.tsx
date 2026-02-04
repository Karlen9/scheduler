"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { ServiceCard } from "@/components/ServiceCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SessionType } from "@/lib/types";

const mockServices: SessionType[] = [
  {
    id: "1",
    type: "personal",
    name: "Мужская тренировка",
    durationMinutes: 60,
    price: 2500,
    currency: "RUB",
  },
  {
    id: "2",
    type: "personal",
    name: "Персональная тренировка",
    durationMinutes: 60,
    price: 3000,
    currency: "RUB",
  },
];

interface ServiceFormData {
  name: string;
  price: string;
  duration: string;
}

export default function ServicesPage() {
  const [services, setServices] = useState<SessionType[]>(mockServices);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<SessionType | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>({
    name: "",
    price: "",
    duration: "60",
  });

  const handleAddClick = () => {
    setEditingService(null);
    setFormData({ name: "", price: "", duration: "60" });
    setShowForm(true);
  };

  const handleEditClick = (service: SessionType) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      price: service.price.toString(),
      duration: service.durationMinutes.toString(),
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.price || !formData.duration) return;

    if (editingService) {
      // Update existing
      setServices((prev) =>
        prev.map((s) =>
          s.id === editingService.id
            ? {
                ...s,
                name: formData.name,
                price: parseInt(formData.price),
                durationMinutes: parseInt(formData.duration),
              }
            : s
        )
      );
    } else {
      // Add new
      const newService: SessionType = {
        id: Date.now().toString(),
        type: "personal",
        name: formData.name,
        price: parseInt(formData.price),
        durationMinutes: parseInt(formData.duration),
        currency: "RUB",
      };
      setServices((prev) => [...prev, newService]);
    }

    setShowForm(false);
    setEditingService(null);
  };

  if (showForm) {
    return (
      <div>
        <TopBar
          title={editingService ? "Редактирование" : "Добавление услуги"}
          showBack
          onBack={() => setShowForm(false)}
        />

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-[var(--app-subtext)] mb-1">
              Название
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Парная тренировка"
              className="w-full px-4 py-3 rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] outline-none focus:ring-2 focus:ring-[#5984d8]"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--app-subtext)] mb-1">
              Цена
            </label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="2500"
              className="w-full px-4 py-3 rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] outline-none focus:ring-2 focus:ring-[#5984d8]"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--app-subtext)] mb-1">
              Длительность в минутах
            </label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              placeholder="60"
              className="w-full px-4 py-3 rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] outline-none focus:ring-2 focus:ring-[#5984d8]"
            />
          </div>

          <PrimaryButton onClick={handleSave}>
            {editingService ? "Сохранить" : "Добавить услугу"}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Услуги и цены" showBack />

      <div className="p-4 space-y-4">
        {/* Add Button */}
        <button
          onClick={handleAddClick}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-[var(--app-divider)] text-[var(--app-subtext)] transition-colors active:bg-[var(--app-surface)]"
        >
          <Plus className="w-5 h-5" />
          <span>Добавить услугу</span>
        </button>

        {/* Services List */}
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onEdit={() => handleEditClick(service)}
          />
        ))}
      </div>
    </div>
  );
}
