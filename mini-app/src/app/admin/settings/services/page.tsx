"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { ServiceCard } from "@/components/ServiceCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SessionType } from "@/lib/types";
import { api } from "@/lib/api";
import { useAdminServices } from "@/hooks/queries";
import { invalidateServices } from "@/hooks/mutations";

interface ServiceFormData {
  type: string;
  name: string;
  price: string;
  duration: string;
}

export default function ServicesPage() {
  const { data: services, isLoading, mutate } = useAdminServices();
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<SessionType | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ServiceFormData>({
    type: "personal",
    name: "",
    price: "",
    duration: "60",
  });

  const handleAddClick = () => {
    setEditingService(null);
    setFormData({ type: "personal", name: "", price: "", duration: "60" });
    setShowForm(true);
  };

  const handleEditClick = (service: SessionType) => {
    setEditingService(service);
    setFormData({
      type: service.type,
      name: service.name,
      price: service.price.toString(),
      duration: service.durationMinutes.toString(),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.duration) return;

    setSaving(true);

    try {
      if (editingService) {
        await api.admin.updateService(editingService.type, {
          name: formData.name,
          price: parseInt(formData.price),
          durationMinutes: parseInt(formData.duration),
        });
      } else {
        await api.admin.createService({
          type: formData.type,
          name: formData.name,
          price: parseInt(formData.price),
          durationMinutes: parseInt(formData.duration),
          currency: "RUB",
        });
      }

      await mutate();
      invalidateServices();
      setShowForm(false);
      setEditingService(null);
    } catch (err) {
      console.error("Failed to save service:", err);
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <TopBar title="Услуги и цены" showBack />
        <div className="p-4 flex justify-center items-center min-h-[200px]">
          <div className="text-muted-foreground">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div>
        <TopBar
          title={editingService ? "Редактирование" : "Добавление услуги"}
          showBack
          onBack={() => setShowForm(false)}
        />

        <div className="p-4 space-y-4">
          {!editingService && (
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Тип услуги
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="personal">Персональная</option>
                <option value="pair">Парная</option>
                <option value="consultation">Консультация</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Название
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              maxLength={100}
              placeholder="Парная тренировка"
              className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Цена
            </label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="2500"
              className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Длительность
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "30 мин", value: "30" },
                { label: "1 час", value: "60" },
                { label: "1.5 часа", value: "90" },
                { label: "2 часа", value: "120" },
                { label: "2.5 часа", value: "150" },
                { label: "3 часа", value: "180" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, duration: opt.value })}
                  className={`py-3 rounded-lg text-sm font-medium transition-colors ${
                    formData.duration === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <PrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение..." : editingService ? "Сохранить" : "Добавить услугу"}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Услуги и цены" showBack />

      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Длительность услуги определяет доступные варианты при записи
        </p>

        {/* Add Button */}
        <button
          onClick={handleAddClick}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors active:bg-card"
        >
          <Plus className="w-5 h-5" />
          <span>Добавить услугу</span>
        </button>

        {/* Services List */}
        {services.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Нет добавленных услуг
          </div>
        ) : (
          services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={() => handleEditClick(service)}
            />
          ))
        )}
      </div>
    </div>
  );
}
