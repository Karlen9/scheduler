package models

import (
	"encoding/json"
	"time"
)

/***************************************************************************************************
* Defines the specialist type used by the shared model layer.
***************************************************************************************************/
type Specialist struct {
	ID                      string     `json:"id"`
	TelegramUserID          int64      `json:"telegramUserId"`
	BotToken                string     `json:"-"`
	BotUsername             string     `json:"botUsername"`
	WebhookSecret           string     `json:"-"`
	Name                    string     `json:"name"`
	Timezone                string     `json:"timezone"`
	CancelCutoffHrs         int        `json:"cancelCutoffHours"`
	TelegramHandle          string     `json:"telegramHandle"`
	Phone                   string     `json:"phone"`
	Email                   string     `json:"email"`
	Specialization          string     `json:"specialization"`
	Bio                     string     `json:"bio"`
	PhotoURL                string     `json:"photoUrl"`
	PhotoRemoved            bool       `json:"-"`
	LocationLatitude        float64    `json:"locationLatitude"`
	LocationLongitude       float64    `json:"locationLongitude"`
	Language                string     `json:"language,omitempty"`
	Wallpaper               string     `json:"wallpaper,omitempty"`
	AvailableDurations      string     `json:"availableDurations,omitempty"`
	ReferralCode            string     `json:"referralCode,omitempty"`
	ReferredViaCode         string     `json:"referredViaCode,omitempty"`
	FirstPaymentAt          *time.Time `json:"firstPaymentAt,omitempty"`
	NotifyNewBookings       bool       `json:"notifyNewBookings"`
	NotifyCancellations     bool       `json:"notifyCancellations"`
	IsActive                bool       `json:"-"`
	CreatedAt               time.Time  `json:"createdAt"`
	DeletedAt               *time.Time `json:"deletedAt,omitempty"`
	SubscriptionStatus      string     `json:"subscriptionStatus,omitempty"`
	SubscriptionPlan        string     `json:"subscriptionPlan,omitempty"`
	TrialEndsAt             *time.Time `json:"trialEndsAt,omitempty"`
	SubscriptionStartedAt   *time.Time `json:"subscriptionStartedAt,omitempty"`
	CurrentPeriodEndAt      *time.Time `json:"currentPeriodEndAt,omitempty"`
	AutoRenew               bool       `json:"autoRenew"`
	CancelAtPeriodEnd       bool       `json:"cancelAtPeriodEnd"`
	YooKassaPaymentMethodID string     `json:"-"`
}

/***************************************************************************************************
* Defines the client type used by the shared model layer.
***************************************************************************************************/
type Client struct {
	ID                  string    `json:"id"`
	TelegramUserID      int64     `json:"telegramUserId"`
	TelegramUsername    string    `json:"telegramUsername,omitempty"`
	SpecialistID        string    `json:"specialistId"`
	Name                string    `json:"name"`
	DisplayName         string    `json:"displayName,omitempty"`
	Phone               string    `json:"phone,omitempty"`
	PhotoURL            string    `json:"photoUrl,omitempty"`
	PhotoRemoved        bool      `json:"-"`
	PreferredDuration   int       `json:"preferredDuration,omitempty"`
	Language            string    `json:"language,omitempty"`
	ReferredViaCode     string    `json:"referredViaCode,omitempty"`
	IsGhost             bool      `json:"isGhost,omitempty"`
	IsSelf              bool      `json:"isSelf,omitempty"`
	IsBlocked           bool      `json:"isBlocked,omitempty"`
	NotifyBookingStatus bool      `json:"notifyBookingStatus"`
	NotifyReminders     bool      `json:"notifyReminders"`
	NotifyDaysOff       bool      `json:"notifyDaysOff"`
	NotifyCancellations bool      `json:"notifyCancellations"`
	CreatedAt           time.Time `json:"createdAt"`
}

/***************************************************************************************************
* Defines the session type type used by the shared model layer.
***************************************************************************************************/
type SessionType struct {
	ID              string `json:"id"`
	SpecialistID    string `json:"-"`
	Type            string `json:"type"` // common, batch
	Name            string `json:"name"`
	DurationMinutes int    `json:"durationMinutes"`
	Price           int    `json:"price"`
	Currency        string `json:"currency"`
	ImageURL        string `json:"imageUrl,omitempty"`
	SessionsCount   int    `json:"sessionsCount,omitempty"`
	IsActive        bool   `json:"-"`
}

/***************************************************************************************************
* Defines the client batch type used by the shared model layer.
***************************************************************************************************/
type ClientBatch struct {
	ID                string       `json:"id"`
	ClientID          string       `json:"clientId"`
	SpecialistID      string       `json:"-"`
	ServiceID         string       `json:"serviceId"`
	TotalSessions     int          `json:"totalSessions"`
	RemainingSessions int          `json:"remainingSessions"`
	CreatedAt         time.Time    `json:"createdAt"`
	Status            string       `json:"status"`
	Service           *SessionType `json:"service,omitempty"`
}

/***************************************************************************************************
* Defines the working hours type used by the shared model layer.
***************************************************************************************************/
type WorkingHours struct {
	ID           string `json:"id"`
	SpecialistID string `json:"-"`
	DayOfWeek    int    `json:"dayOfWeek"`
	StartTime    string `json:"startTime"`
	EndTime      string `json:"endTime"`
}

/***************************************************************************************************
* Defines the booking status type used by the shared model layer.
***************************************************************************************************/
type BookingStatus string

/***************************************************************************************************
* Groups related constants declared together for this module.
***************************************************************************************************/
const (
	/***************************************************************************************************
	* Defines the booking status pending value used by the shared model layer.
	*
	* Usage context:
	* - Reused by the shared model layer to keep shared values centralized.
	***************************************************************************************************/
	BookingStatusPending BookingStatus = "pending"
	/***************************************************************************************************
	* Defines the booking status confirmed value used by the shared model layer.
	*
	* Usage context:
	* - Reused by the shared model layer to keep shared values centralized.
	***************************************************************************************************/
	BookingStatusConfirmed BookingStatus = "confirmed"
	/***************************************************************************************************
	* Defines the booking status rejected value used by the shared model layer.
	*
	* Usage context:
	* - Reused by the shared model layer to keep shared values centralized.
	***************************************************************************************************/
	BookingStatusRejected BookingStatus = "rejected"
	/***************************************************************************************************
	* Defines the booking status cancelled value used by the shared model layer.
	*
	* Usage context:
	* - Reused by the shared model layer to keep shared values centralized.
	***************************************************************************************************/
	BookingStatusCancelled BookingStatus = "cancelled"
	/***************************************************************************************************
	* Defines the booking status completed value used by the shared model layer.
	*
	* Usage context:
	* - Reused by the shared model layer to keep shared values centralized.
	***************************************************************************************************/
	BookingStatusCompleted BookingStatus = "completed"
	/***************************************************************************************************
	* Defines the booking status cancel requested value used by the shared model layer.
	*
	* Usage context:
	* - Reused by the shared model layer to keep shared values centralized.
	***************************************************************************************************/
	BookingStatusCancelRequested BookingStatus = "cancel_requested"
	/***************************************************************************************************
	* Defines the booking status reschedule pending value used by the shared model layer.
	*
	* Usage context:
	* - Reused by the shared model layer to keep shared values centralized.
	***************************************************************************************************/
	BookingStatusReschedulePending BookingStatus = "reschedule_pending"
)

/***************************************************************************************************
* Defines the cancelled by type used by the shared model layer.
***************************************************************************************************/
type CancelledBy string

/***************************************************************************************************
* Groups related constants declared together for this module.
***************************************************************************************************/
const (
	/***************************************************************************************************
	* Defines the cancelled by client value used by the shared model layer.
	*
	* Usage context:
	* - Reused by the shared model layer to keep shared values centralized.
	***************************************************************************************************/
	CancelledByClient CancelledBy = "client"
	/***************************************************************************************************
	* Defines the cancelled by specialist value used by the shared model layer.
	*
	* Usage context:
	* - Reused by the shared model layer to keep shared values centralized.
	***************************************************************************************************/
	CancelledBySpecialist CancelledBy = "specialist"
)

/***************************************************************************************************
* Defines the booking type used by the shared model layer.
***************************************************************************************************/
type Booking struct {
	ID                  string        `json:"id"`
	SpecialistID        string        `json:"-"`
	ClientID            string        `json:"-"`
	SessionTypeID       string        `json:"-"`
	ClientBatchID       string        `json:"clientBatchId,omitempty"`
	StartsAt            time.Time     `json:"startsAt"`
	EndsAt              time.Time     `json:"endsAt"`
	ClientName          string        `json:"clientName"`
	ClientMessage       string        `json:"clientMessage,omitempty"`
	Status              BookingStatus `json:"status"`
	CancelReason        string        `json:"cancelReason,omitempty"`
	CancelledBy         CancelledBy   `json:"cancelledBy,omitempty"`
	CreatedAt           time.Time     `json:"createdAt"`
	DurationMinutes     int           `json:"durationMinutes,omitempty"`
	CreatedBy           string        `json:"createdBy,omitempty"`
	RecurringScheduleID string        `json:"recurringScheduleId,omitempty"`
	ReplacesBookingID   string        `json:"replacesBookingId,omitempty"`

	/***************************************************************************************************
	* Joined fields for API responses.
	***************************************************************************************************/
	SessionType            *SessionType `json:"sessionType,omitempty"`
	ClientPhotoURL         string       `json:"clientPhotoUrl,omitempty"`
	ClientDisplayName      string       `json:"clientDisplayName,omitempty"`
	ClientIsGhost          bool         `json:"clientIsGhost,omitempty"`
	ClientIsSelf           bool         `json:"clientIsSelf,omitempty"`
	ClientTelegramID       int64        `json:"clientTelegramUserId,omitempty"`
	ClientTelegramUsername string       `json:"clientTelegramUsername,omitempty"`
	Client                 *Client      `json:"-"`
}

type BookingListResponse struct {
	Bookings   []Booking `json:"bookings"`
	Total      int       `json:"total"`
	Page       int       `json:"page"`
	Limit      int       `json:"limit"`
	TotalPages int       `json:"totalPages"`
}

type ClientListResponse struct {
	Clients     []Client `json:"clients"`
	Total       int      `json:"total"`
	Page        int      `json:"page"`
	Limit       int      `json:"limit"`
	TotalPages  int      `json:"totalPages"`
	SearchQuery string   `json:"searchQuery,omitempty"`
}

/***************************************************************************************************
* RecurringScheduleStatus represents the status of a recurring schedule.
***************************************************************************************************/
type RecurringScheduleStatus string

/***************************************************************************************************
* Groups related constants declared together for this module.
***************************************************************************************************/
const (
	/***************************************************************************************************
	* Defines the recurring schedule status pending value used by the shared model layer.
	*
	* Usage context:
	* - Reused by the shared model layer to keep shared values centralized.
	***************************************************************************************************/
	RecurringScheduleStatusPending RecurringScheduleStatus = "pending"
	/***************************************************************************************************
	* Defines the recurring schedule status active value used by the shared model layer.
	*
	* Usage context:
	* - Reused by the shared model layer to keep shared values centralized.
	***************************************************************************************************/
	RecurringScheduleStatusActive RecurringScheduleStatus = "active"
	/***************************************************************************************************
	* Defines the recurring schedule status declined value used by the shared model layer.
	*
	* Usage context:
	* - Reused by the shared model layer to keep shared values centralized.
	***************************************************************************************************/
	RecurringScheduleStatusDeclined RecurringScheduleStatus = "declined"
	/***************************************************************************************************
	* Defines the recurring schedule status cancelled value used by the shared model layer.
	*
	* Usage context:
	* - Reused by the shared model layer to keep shared values centralized.
	***************************************************************************************************/
	RecurringScheduleStatusCancelled RecurringScheduleStatus = "cancelled"
)

/***************************************************************************************************
* RecurringSchedule represents a recurring weekly booking schedule.
***************************************************************************************************/
type RecurringSchedule struct {
	ID              string                  `json:"id"`
	SpecialistID    string                  `json:"-"`
	ClientID        string                  `json:"-"`
	ClientName      string                  `json:"clientName"`
	DayOfWeek       int                     `json:"dayOfWeek"`
	Time            string                  `json:"time"`
	DurationMinutes int                     `json:"durationMinutes"`
	Status          RecurringScheduleStatus `json:"status"`
	CreatedBy       string                  `json:"createdBy"`
	CreatedAt       time.Time               `json:"createdAt"`
	/***************************************************************************************************
	* Phase 2 fields.
	***************************************************************************************************/
	SessionTypeID string `json:"sessionTypeId,omitempty"`
	DaysOfWeek    string `json:"daysOfWeek,omitempty"`
	StartDate     string `json:"startDate,omitempty"`
	EndDate       string `json:"endDate,omitempty"`
	DayTimes      string `json:"dayTimes,omitempty"`
	/***************************************************************************************************
	* Joined fields.
	***************************************************************************************************/
	SessionType       *SessionType `json:"sessionType,omitempty"`
	ClientPhotoURL    string       `json:"clientPhotoUrl,omitempty"`
	ClientDisplayName string       `json:"clientDisplayName,omitempty"`
	ClientIsSelf      bool         `json:"clientIsSelf,omitempty"`
	Bookings          []Booking    `json:"bookings,omitempty"`
}

/***************************************************************************************************
* TimeSlot represents an available time slot for booking.
***************************************************************************************************/
type TimeSlot struct {
	Time      string `json:"time"`
	EndTime   string `json:"endTime,omitempty"`
	Available bool   `json:"available"`
	Mine      bool   `json:"mine,omitempty"`
}

/***************************************************************************************************
* DayOff represents a day when specialist is not available.
***************************************************************************************************/
type DayOff struct {
	ID           string    `json:"id"`
	SpecialistID string    `json:"-"`
	Date         time.Time `json:"-"`
	Reason       string    `json:"reason,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
}

/***************************************************************************************************
* MarshalJSON serializes DayOff with date as "YYYY-MM-DD" string (not RFC3339 timestamp).
*
* Parameters:
* - None.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
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

// SupportThread maps a prospective specialist (a Telegram user DMing the master bot) to a
// forum topic inside the owner's support supergroup. Messages in either direction are relayed
// via this mapping while ClosedAt is nil.
type SupportThread struct {
	ID               string     `json:"id"`
	TelegramUserID   int64      `json:"telegramUserId"`
	TelegramUsername string     `json:"telegramUsername"`
	DisplayName      string     `json:"displayName"`
	LanguageCode     string     `json:"languageCode"`
	TopicID          int        `json:"topicId"`
	CreatedAt        time.Time  `json:"createdAt"`
	LastMessageAt    *time.Time `json:"lastMessageAt,omitempty"`
	ClosedAt         *time.Time `json:"closedAt,omitempty"`
}
