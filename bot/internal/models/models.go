package models

import "time"

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
	PreferredDuration   int       `json:"preferredDuration,omitempty"`
	NotifyBookingStatus bool      `json:"notifyBookingStatus"`
	NotifyReminders     bool      `json:"notifyReminders"`
	NotifyDaysOff       bool      `json:"notifyDaysOff"`
	CreatedAt           time.Time `json:"createdAt"`
}

type SessionType struct {
	ID              string `json:"id"`
	TrainerID       string `json:"-"`
	Type            string `json:"type"` // personal, pair, consultation
	Name            string `json:"name"`
	DurationMinutes int    `json:"durationMinutes"`
	Price           int    `json:"price"`
	Currency        string `json:"currency"`
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
	BookingStatusPending   BookingStatus = "pending"
	BookingStatusConfirmed BookingStatus = "confirmed"
	BookingStatusRejected  BookingStatus = "rejected"
	BookingStatusCancelled BookingStatus = "cancelled"
	BookingStatusCompleted BookingStatus = "completed"
)

type CancelledBy string

const (
	CancelledByClient  CancelledBy = "client"
	CancelledByTrainer CancelledBy = "trainer"
)

type Booking struct {
	ID              string        `json:"id"`
	TrainerID       string        `json:"-"`
	ClientID        string        `json:"-"`
	SessionTypeID   string        `json:"-"`
	StartsAt        time.Time     `json:"startsAt"`
	EndsAt          time.Time     `json:"endsAt"`
	ClientName      string        `json:"clientName"`
	ClientMessage   string        `json:"clientMessage,omitempty"`
	Status          BookingStatus `json:"status"`
	CancelReason    string        `json:"cancelReason,omitempty"`
	CancelledBy     CancelledBy   `json:"cancelledBy,omitempty"`
	CreatedAt       time.Time     `json:"createdAt"`
	DurationMinutes int           `json:"durationMinutes,omitempty"`

	// Joined fields for API responses
	SessionType *SessionType `json:"sessionType,omitempty"`
	Client      *Client      `json:"-"`
}

// TimeSlot represents an available time slot for booking
type TimeSlot struct {
	Time          string `json:"time"`
	EndTime       string `json:"endTime,omitempty"`
	Available     bool   `json:"available"`
	WaitlistCount int    `json:"waitlistCount,omitempty"`
	HasMyWaitlist bool   `json:"hasMyWaitlist,omitempty"`
}

// WaitlistStatus represents the status of a waitlist entry
type WaitlistStatus string

const (
	WaitlistStatusWaiting   WaitlistStatus = "waiting"
	WaitlistStatusOffered   WaitlistStatus = "offered"
	WaitlistStatusBooked    WaitlistStatus = "booked"
	WaitlistStatusDeclined  WaitlistStatus = "declined"
	WaitlistStatusExpired   WaitlistStatus = "expired"
	WaitlistStatusCancelled WaitlistStatus = "cancelled"
)

// WaitlistEntry represents a client's position in a waitlist for a time slot
type WaitlistEntry struct {
	ID              string         `json:"id"`
	TrainerID       string         `json:"-"`
	ClientID        string         `json:"-"`
	StartsAt        time.Time      `json:"startsAt"`
	EndsAt          time.Time      `json:"endsAt"`
	DurationMinutes int            `json:"durationMinutes"`
	ClientName      string         `json:"clientName"`
	Status          WaitlistStatus `json:"status"`
	OfferedAt       *time.Time     `json:"offeredAt,omitempty"`
	CreatedAt       time.Time      `json:"createdAt"`
	Position        int            `json:"position,omitempty"`
}

// DayOff represents a day when trainer is not available
type DayOff struct {
	ID        string    `json:"id"`
	TrainerID string    `json:"-"`
	Date      time.Time `json:"date"`
	Reason    string    `json:"reason,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}
