package db

import "testing"

func TestCreateSpecialistReactivatesSoftDeletedRow(t *testing.T) {
	setupStatsTestDB(t)

	first, err := CreateSpecialist(7001, "token-reactivate-1", "reactivateonebot", "First Name", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist(first): %v", err)
	}
	if err := SoftDeleteSpecialistCascade(first.ID); err != nil {
		t.Fatalf("SoftDeleteSpecialistCascade: %v", err)
	}

	second, err := CreateSpecialist(7001, "token-reactivate-2", "reactivatetwobot", "Second Name", "UTC", 12)
	if err != nil {
		t.Fatalf("CreateSpecialist(second): %v", err)
	}
	if second.ID != first.ID {
		t.Fatalf("expected the soft-deleted row to be reused, got %s instead of %s", second.ID, first.ID)
	}
	if !second.IsActive || second.DeletedAt != nil {
		t.Fatalf("expected reactivated row to be active, got IsActive=%v DeletedAt=%v", second.IsActive, second.DeletedAt)
	}
	if second.BotUsername != "reactivatetwobot" || second.Name != "Second Name" || second.CancelCutoffHrs != 12 {
		t.Fatalf("expected reactivated row to carry the new bot details, got %+v", second)
	}
}
