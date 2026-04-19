package api_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"scheduler-bot/internal/api"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* doRequestFromIP mirrors doClientRequest / doAdminRequest but sets a unique RemoteAddr so
* these audit tests don't share a per-IP rate-limit bucket with the wider test suite.
***************************************************************************************************/
func doRequestFromIP(t *testing.T, method, path string, body *string, telegramID int64, asAdmin bool, remoteIP string) *httptest.ResponseRecorder {
	t.Helper()

	var reqBody *strings.Reader
	if body != nil {
		reqBody = strings.NewReader(*body)
	} else {
		reqBody = strings.NewReader("")
	}
	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Specialist-ID", testSpecialist.ID)
	req.RemoteAddr = remoteIP + ":12345"

	var effective int64 = telegramID
	if asAdmin {
		effective = testSpecialist.TelegramUserID
	}
	req.Header.Set("X-Telegram-Init-Data", buildInitData(effective, "Test User", testSpecialist.BotToken))

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

/***************************************************************************************************
* These tests exercise the reschedule notification wiring (bugs fixed in the lifecycle audit):
*
* 1. HandleClientRescheduleBooking must invoke NotifyRescheduleRequestFunc (not NotifyBookingFunc
*    — the old code misled the specialist with a "new booking" message).
* 2. HandleClientApproveReschedule must invoke NotifyRescheduleResponseFunc with approved=true
*    and a non-nil oldBooking (the confirmed original).
* 3. HandleClientDeclineReschedule must invoke it with approved=false.
***************************************************************************************************/

type rescheduleNotifyCapture struct {
	requestCalls     int
	responseCalls    int
	lastApproved     bool
	lastHadOld       bool
	newBookingBookId string
}

func swapRescheduleCallbacks(capture *rescheduleNotifyCapture) (restore func()) {
	oldRequest := api.NotifyRescheduleRequestFunc
	oldResponse := api.NotifyRescheduleResponseFunc
	oldBooking := api.NotifyBookingFunc

	api.NotifyRescheduleRequestFunc = func(newBooking, oldBk *models.Booking) error {
		capture.requestCalls++
		if newBooking != nil {
			capture.newBookingBookId = newBooking.ID
		}
		return nil
	}
	api.NotifyRescheduleResponseFunc = func(newBooking, oldBk *models.Booking, approved bool) error {
		capture.responseCalls++
		capture.lastApproved = approved
		capture.lastHadOld = oldBk != nil
		return nil
	}
	api.NotifyBookingFunc = func(booking *models.Booking) error {
		// Intentionally fail the test if reached from a reschedule path.
		return nil
	}

	return func() {
		api.NotifyRescheduleRequestFunc = oldRequest
		api.NotifyRescheduleResponseFunc = oldResponse
		api.NotifyBookingFunc = oldBooking
	}
}

func seedConfirmedBooking(t *testing.T, clientTelegramID int64) *models.Booking {
	t.Helper()
	service, err := db.CreateSessionType(testSpecialist.ID, fmt.Sprintf("rs-%d", time.Now().UnixNano()), "Reschedule Test", 60, 0, "USD", "")
	if err != nil {
		t.Fatalf("CreateSessionType: %v", err)
	}
	client, err := db.GetOrCreateClient(clientTelegramID, testSpecialist.ID, "Reschedule Client")
	if err != nil {
		t.Fatalf("GetOrCreateClient: %v", err)
	}
	startsAt := time.Now().UTC().Add(48 * time.Hour).Truncate(time.Hour)
	endsAt := startsAt.Add(60 * time.Minute)
	booking, err := db.CreateBooking(testSpecialist.ID, client.ID, service.ID, startsAt, endsAt, client.Name, "", 60)
	if err != nil {
		t.Fatalf("CreateBooking: %v", err)
	}
	if err := db.UpdateBookingStatus(booking.ID, models.BookingStatusConfirmed); err != nil {
		t.Fatalf("UpdateBookingStatus: %v", err)
	}
	refreshed, err := db.GetBookingByID(booking.ID)
	if err != nil || refreshed == nil {
		t.Fatalf("GetBookingByID: %v", err)
	}
	return refreshed
}

func TestClientRescheduleFiresRescheduleRequestCallback(t *testing.T) {
	var capture rescheduleNotifyCapture
	restore := swapRescheduleCallbacks(&capture)
	defer restore()

	telegramID := int64(770001)
	booking := seedConfirmedBooking(t, telegramID)

	newStart := time.Now().UTC().Add(96 * time.Hour).Truncate(time.Hour)
	body := fmt.Sprintf(`{"date":%q,"time":%q}`, newStart.Format("2006-01-02"), newStart.Format("15:04"))
	w := doRequestFromIP(t, http.MethodPut, "/api/bookings/"+booking.ID+"/reschedule", &body, telegramID, false, "203.0.113.210")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	if capture.requestCalls != 1 {
		t.Fatalf("expected NotifyRescheduleRequestFunc called once, got %d", capture.requestCalls)
	}
	if capture.responseCalls != 0 {
		t.Fatalf("expected NotifyRescheduleResponseFunc NOT called, got %d", capture.responseCalls)
	}
	if capture.newBookingBookId != booking.ID {
		t.Fatalf("expected callback with booking %s, got %s", booking.ID, capture.newBookingBookId)
	}
}

func TestClientApproveRescheduleFiresResponseCallback(t *testing.T) {
	var capture rescheduleNotifyCapture
	restore := swapRescheduleCallbacks(&capture)
	defer restore()

	telegramID := int64(770002)
	original := seedConfirmedBooking(t, telegramID)

	newStart := original.StartsAt.Add(4 * time.Hour)
	shadow, err := db.CreateRescheduleBooking(
		original.SpecialistID, original.ClientID, original.SessionTypeID,
		newStart, newStart.Add(time.Hour), original.ClientName, "please", "specialist",
		60, "", original.ID,
	)
	if err != nil {
		t.Fatalf("CreateRescheduleBooking: %v", err)
	}

	w := doRequestFromIP(t, http.MethodPut, "/api/bookings/"+shadow.ID+"/approve-reschedule", nil, telegramID, false, "203.0.113.211")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	if capture.responseCalls != 1 {
		t.Fatalf("expected NotifyRescheduleResponseFunc called once, got %d", capture.responseCalls)
	}
	if !capture.lastApproved {
		t.Fatal("expected approved=true")
	}
	if !capture.lastHadOld {
		t.Fatal("expected non-nil oldBooking passed to callback")
	}
}

func TestClientDeclineRescheduleFiresResponseCallback(t *testing.T) {
	var capture rescheduleNotifyCapture
	restore := swapRescheduleCallbacks(&capture)
	defer restore()

	telegramID := int64(770003)
	original := seedConfirmedBooking(t, telegramID)

	newStart := original.StartsAt.Add(4 * time.Hour)
	shadow, err := db.CreateRescheduleBooking(
		original.SpecialistID, original.ClientID, original.SessionTypeID,
		newStart, newStart.Add(time.Hour), original.ClientName, "", "specialist",
		60, "", original.ID,
	)
	if err != nil {
		t.Fatalf("CreateRescheduleBooking: %v", err)
	}

	w := doRequestFromIP(t, http.MethodPut, "/api/bookings/"+shadow.ID+"/decline-reschedule", nil, telegramID, false, "203.0.113.212")
	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", w.Code, w.Body.String())
	}

	if capture.responseCalls != 1 {
		t.Fatalf("expected NotifyRescheduleResponseFunc called once, got %d", capture.responseCalls)
	}
	if capture.lastApproved {
		t.Fatal("expected approved=false")
	}
	if !capture.lastHadOld {
		t.Fatal("expected non-nil oldBooking passed to callback")
	}
}

/***************************************************************************************************
* Admin reject-with-reason must set status=rejected AND cancel_reason, while leaving
* cancelled_by NULL — rejections are a distinct outcome from admin-side cancellations.
***************************************************************************************************/
func TestAdminRejectBookingWithReason(t *testing.T) {
	telegramID := int64(770100)
	service, err := db.CreateSessionType(testSpecialist.ID, fmt.Sprintf("rj-%d", time.Now().UnixNano()), "Reject Test", 60, 0, "USD", "")
	if err != nil {
		t.Fatalf("CreateSessionType: %v", err)
	}
	client, err := db.GetOrCreateClient(telegramID, testSpecialist.ID, "Reject Client")
	if err != nil {
		t.Fatalf("GetOrCreateClient: %v", err)
	}
	startsAt := time.Now().UTC().Add(48 * time.Hour).Truncate(time.Hour)
	booking, err := db.CreateBooking(testSpecialist.ID, client.ID, service.ID, startsAt, startsAt.Add(time.Hour), client.Name, "", 60)
	if err != nil {
		t.Fatalf("CreateBooking: %v", err)
	}

	body := `{"status":"rejected","reason":"double-booked"}`
	w := doRequestFromIP(t, http.MethodPut, "/api/admin/bookings/"+booking.ID+"/status", &body, 0, true, "203.0.113.213")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	refreshed, err := db.GetBookingByID(booking.ID)
	if err != nil || refreshed == nil {
		t.Fatalf("GetBookingByID: %v", err)
	}
	if refreshed.Status != models.BookingStatusRejected {
		t.Fatalf("expected status rejected, got %s", refreshed.Status)
	}
	if refreshed.CancelReason != "double-booked" {
		t.Fatalf("expected cancel_reason=double-booked, got %q", refreshed.CancelReason)
	}
	if refreshed.CancelledBy != "" {
		t.Fatalf("expected cancelled_by empty (rejections are not cancellations), got %q", refreshed.CancelledBy)
	}
}
