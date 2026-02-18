"use client";

import { useState, useRef } from "react";
import { Plus, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { TopBar } from "@/components/TopBar";
import { ServiceCard } from "@/components/ServiceCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SessionType } from "@/lib/types";
import { api, getPhotoUrl } from "@/lib/api";
import { useAdminServices } from "@/hooks/queries";
import { invalidateServices } from "@/hooks/mutations";

interface ServiceFormData {
  type: string;
  name: string;
  price: string;
  duration: string;
  imageUrl: string;
}

export default function ServicesPage() {
  const t = useTranslations("AdminServices");
  const tc = useTranslations("Common");
  const td = useTranslations("Duration");
  const te = useTranslations("Errors");
  const tsp = useTranslations("ServicesPage");
  const { data: services, isLoading, mutate } = useAdminServices();
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<SessionType | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<ServiceFormData>({
    type: "personal",
    name: "",
    price: "",
    duration: "60",
    imageUrl: "",
  });

  const handleAddClick = () => {
    setEditingService(null);
    setFormData({ type: "personal", name: "", price: "", duration: "60", imageUrl: "" });
    setShowForm(true);
  };

  const handleEditClick = (service: SessionType) => {
    setEditingService(service);
    setFormData({
      type: service.type,
      name: service.name,
      price: service.price.toString(),
      duration: service.durationMinutes.toString(),
      imageUrl: service.imageUrl || "",
    });
    setShowForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await api.admin.uploadPhoto(file);
      setFormData((prev) => ({ ...prev, imageUrl: result.fileId }));
    } catch (err) {
      console.error("Failed to upload image:", err);
      toast.error(te("photoUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.duration) return;

    setSaving(true);

    try {
      if (editingService) {
        await api.admin.updateService(editingService.id, {
          type: formData.type,
          name: formData.name,
          price: parseInt(formData.price),
          durationMinutes: parseInt(formData.duration),
          imageUrl: formData.imageUrl,
        });
      } else {
        await api.admin.createService({
          type: formData.type,
          name: formData.name,
          price: parseInt(formData.price),
          durationMinutes: parseInt(formData.duration),
          currency: "RUB",
          imageUrl: formData.imageUrl,
        });
      }

      await mutate();
      invalidateServices();
      setShowForm(false);
      setEditingService(null);
    } catch (err) {
      console.error("Failed to save service:", err);
      toast.error(err instanceof Error ? err.message : te("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <TopBar title={t("title")} showBack />
        <div className="p-4 flex justify-center items-center min-h-[200px]">
          <div className="text-muted-foreground">{tc("loading")}</div>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div>
        <TopBar
          title={editingService ? t("editTitle") : t("addTitle")}
          showBack
          onBack={() => setShowForm(false)}
        />

        <div className="p-4 space-y-4">
          {/* Image Upload */}
          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              {t("servicePhoto")}
            </label>
            <div className="flex items-center gap-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center overflow-hidden cursor-pointer transition-opacity active:opacity-80"
              >
                {formData.imageUrl ? (
                  <img
                    src={getPhotoUrl(formData.imageUrl)}
                    alt={t("servicePhoto")}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              {formData.imageUrl && (
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, imageUrl: "" }))}
                  className="w-8 h-8 rounded-full bg-card flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              {uploading && (
                <span className="text-xs text-muted-foreground">{tc("uploading")}</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              {t("serviceType")}
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="personal">{t("typePersonal")}</option>
              <option value="pair">{t("typePair")}</option>
              <option value="consultation">{t("typeConsultation")}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              {t("nameLabel")}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              maxLength={100}
              placeholder={t("namePlaceholder")}
              className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              {t("priceLabel")}
            </label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder={t("pricePlaceholder")}
              className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              {t("durationLabel")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: td("min30"), value: "30" },
                { label: td("hour1"), value: "60" },
                { label: td("hour1_5"), value: "90" },
                { label: td("hour2"), value: "120" },
                { label: td("hour2_5"), value: "150" },
                { label: td("hour3"), value: "180" },
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
            {saving ? tc("saving") : editingService ? tc("save") : t("addButton")}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={t("title")} showBack />

      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          {tsp("durationDeterminesSlots")}
        </p>

        {/* Add Button */}
        <button
          onClick={handleAddClick}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors active:bg-card"
        >
          <Plus className="w-5 h-5" />
          <span>{tsp("addService")}</span>
        </button>

        {/* Services List */}
        {services.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {tsp("noServices")}
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
