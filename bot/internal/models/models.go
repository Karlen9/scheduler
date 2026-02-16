package models

import (
	"encoding/json"
	"time"
)

type Trainer struct {
	ID                  string    `json:"id"`
	TelegramUserID      int64     `json:"telegramUserId"`
	BotToken            string    `json:"-"`
	BotUsername         string    `json:"botUsername"`
	WebhookSecret       string    `json:"-"`
	Name                string    `json:"name"`
	Timezone            string    `json:"timezone"`
	CancelCutoffHrs     int       `json:"cancelCutoffHours"`
	TelegramHandle      string    `json:"telegramHandle"`
	Phone               string    `json:"phone"`
	Specialization      string    `json:"specialization"`
	Bio                 string    `json:"bio"`
	PhotoURL            string    `json:"photoUrl"`
	GymLatitude         float64   `json:"gymLatitude"`
	GymLongitude        float64   `json:"gymLongitude"`
	AvailableDurations  string    `json:"availableDurations,omitempty"`
	NotifyNewBookings   bool      `json:"notifyNewBookings"`
	NotifyCancellations bool      `json:"notifyCancellations"`
	IsActive            bool      `json:"-"`
	CreatedAt           time.Time `json:"createdAt"`
}

type Client struct {
	ID                  string    `json:"id"`
	TelegramUserID      int64     `json:"telegramUserId"`
	TrainerID           string    `json:"trainerId"`
	Name                string    `json:"name"`
	Phone               string    `json:"phone,omitempty"`
	PhotoURL            string    `json:"photoUrl,omitempty"`
	PreferredDuration   int       `json:"preferredDuration,omitempty"`
	NotifyBookingStatus bool      `json:"notifyBookingStatus"`
	NotifyReminders     bool      `json:"notifyReminders"`
	NotifyDaysOff          bool      `json:"notifyDaysOff"`
	NotifyCancellations    bool      `json:"notifyCancellations"`
	CreatedAt              time.Time `json:"createdAt"`
}

type SessionType struct {
	ID              string `json:"id"`
	TrainerID       string `json:"-"`
	Type            string `json:"type"` // personal, pair, consultation
	Name            string `json:"name"`
	DurationMinutes int    `json:"durationMinutes"`
	Price           int    `json:"price"`
	Currency        string `json:"currency"`
	ImageURL        string `json:"imageUrl,omitempty"`
	IsActive        bool   `json:"-"`
}

type WorkingHours struct {
	ID        string `json:"id"`
	TrainerID string `json:"-"`
	DayOfWeek int    `json:"dayOfWeek"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
}

type BookingStatus string

const (
	BookingStatusPending            BookingStatus = "pending"
	BookingStatusConfirmed          BookingStatus = "confirmed"
	BookingStatusRejected           BookingStatus = "rejected"
	BookingStatusCancelled          BookingStatus = "cancelled"
	BookingStatusCompleted          BookingStatus = "completed"
	BookingStatusCancelRequested    BookingStatus = "cancel_requested"
	BookingStatusReschedulePending  BookingStatus = "reschedule_pending"
)

type CancelledBy string

const (
	CancelledByClient  CancelledBy = "client"
	CancelledByTrainer CancelledBy = "trainer"
)

type Booking struct {
	ID                   string        `json:"id"`
	TrainerID            string        `json:"-"`
	ClientID             string        `json:"-"`
	SessionTypeID        string        `json:"-"`
	StartsAt             time.Time     `json:"startsAt"`
	EndsAt               time.Time     `json:"endsAt"`
	ClientName           string        `json:"clientName"`
	ClientMessage        string        `json:"clientMessage,omitempty"`
	Status               BookingStatus `json:"status"`
	CancelReason         string        `json:"cancelReason,omitempty"`
	CancelledBy          CancelledBy   `json:"cancelledBy,omitempty"`
	CreatedAt            time.Time     `json:"createdAt"`
	DurationMinutes      int           `json:"durationMinutes,omitempty"`
	CreatedBy            string        `json:"createdBy,omitempty"`
	RecurringScheduleID  string        `json:"recurringScheduleId,omitempty"`
	ReplacesBookingID    string        `json:"replacesBookingId,omitempty"`

	// Joined fields for API responses
	SessionType    *SessionType `json:"sessionType,omitempty"`
	ClientPhotoURL string       `json:"clientPhotoUrl,omitempty"`
	Client         *Client      `json:"-"`
}

// RecurringScheduleStatus represents the status of a recurring schedule
type RecurringScheduleStatus string

const (
	RecurringScheduleStatusPending   RecurringScheduleStatus = "pending"
	RecurringScheduleStatusActive    RecurringScheduleStatus = "active"
	RecurringScheduleStatusDeclined  RecurringScheduleStatus = "declined"
	RecurringScheduleStatusCancelled RecurringScheduleStatus = "cancelled"
)

// RecurringSchedule represents a recurring weekly booking schedule
type RecurringSchedule struct {
	ID              string                  `json:"id"`
	TrainerID       string                  `json:"-"`
	ClientID        string                  `json:"-"`
	ClientName      string                  `json:"clientName"`
	DayOfWeek       int                     `json:"dayOfWeek"`
	Time            string                  `json:"time"`
	DurationMinutes int                     `json:"durationMinutes"`
	Status          RecurringScheduleStatus `json:"status"`
	CreatedBy       string                  `json:"createdBy"`
	CreatedAt       time.Time               `json:"createdAt"`
	// Phase 2 fields
	SessionTypeID string       `json:"sessionTypeId,omitempty"`
	DaysOfWeek    string       `json:"daysOfWeek,omitempty"`
	StartDate     string       `json:"startDate,omitempty"`
	EndDate       string       `json:"endDate,omitempty"`
	DayTimes      string       `json:"dayTimes,omitempty"`
	// Joined fields
	SessionType    *SessionType `json:"sessionType,omitempty"`
	ClientPhotoURL string       `json:"clientPhotoUrl,omitempty"`
	Bookings       []Booking    `json:"bookings,omitempty"`
}

// TimeSlot represents an available time slot for booking
type TimeSlot struct {
	Time      string `json:"time"`
	EndTime   string `json:"endTime,omitempty"`
	Available bool   `json:"available"`
}

// DayOff represents a day when trainer is not available
type DayOff struct {
	ID        string    `json:"id"`
	TrainerID string    `json:"-"`
	Date      time.Time `json:"-"`
	Reason    string    `json:"reason,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// MarshalJSON serializes DayOff with date as "YYYY-MM-DD" string (not RFC3339 timestamp)
func (d DayOff) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		ID        string    `json:"id"`
		Date      string    `json:"date"`
		Reason    string    `json:"reason,omitempty"`
		CreatedAt time.Time `json:"createdAt"`
	}{
		ID:        d.ID,
		Date:      d.Date.Format("2006-01-02"),
		Reason:    d.Reason,
		CreatedAt: d.CreatedAt,
	})
}
