package models

/***************************************************************************************************
* Defines the duration count type used by the shared model layer.
***************************************************************************************************/
type DurationCount struct {
	Duration int `json:"duration"`
	Count    int `json:"count"`
}

/***************************************************************************************************
* Defines the monthly count type used by the shared model layer.
***************************************************************************************************/
type MonthlyCount struct {
	Month string `json:"month"`
	Count int    `json:"count"`
}

/***************************************************************************************************
* Defines the top client stat type used by the shared model layer.
***************************************************************************************************/
type TopClientStat struct {
	Name     string `json:"name"`
	Count    int    `json:"count"`
	PhotoURL string `json:"photoUrl,omitempty"`
}

/***************************************************************************************************
* Defines the revenue by month type used by the shared model layer.
***************************************************************************************************/
type RevenueByMonth struct {
	Month   string `json:"month"`
	Revenue int    `json:"revenue"`
}

/***************************************************************************************************
* Defines the revenue by service type used by the shared model layer.
***************************************************************************************************/
type RevenueByService struct {
	Name    string `json:"name"`
	Revenue int    `json:"revenue"`
}

/***************************************************************************************************
* Defines the client stats type used by the shared model layer.
***************************************************************************************************/
type ClientStats struct {
	TotalSessions      int             `json:"totalSessions"`
	TotalHours         float64         `json:"totalHours"`
	CompletionRate     float64         `json:"completionRate"`
	SessionsThisMonth  int             `json:"sessionsThisMonth"`
	SessionsLastMonth  int             `json:"sessionsLastMonth"`
	CurrentStreak      int             `json:"currentStreak"`
	LongestStreak      int             `json:"longestStreak"`
	MostCommonDay      *int            `json:"mostCommonDay"`
	MostCommonTimeSlot *string         `json:"mostCommonTimeSlot"`
	AverageDuration    int             `json:"averageDuration"`
	DurationBreakdown  []DurationCount `json:"durationBreakdown"`
	MonthlyTrend       []MonthlyCount  `json:"monthlyTrend"`
}

/***************************************************************************************************
* Defines the admin stats type used by the shared model layer.
***************************************************************************************************/
type AdminStats struct {
	TotalBookings       int                `json:"totalBookings"`
	ActiveClients       int                `json:"activeClients"`
	CompletionRate      float64            `json:"completionRate"`
	BookingsThisMonth   int                `json:"bookingsThisMonth"`
	BookingsLastMonth   int                `json:"bookingsLastMonth"`
	TotalClients        int                `json:"totalClients"`
	NewClientsThisMonth int                `json:"newClientsThisMonth"`
	TopClients          []TopClientStat    `json:"topClients"`
	ReturningRate       float64            `json:"returningRate"`
	BusiestDay          *int               `json:"busiestDay"`
	BusiestTimeSlot     *string            `json:"busiestTimeSlot"`
	AvgBookingsPerWeek  float64            `json:"avgBookingsPerWeek"`
	CancellationRate    float64            `json:"cancellationRate"`
	RevenueThisMonth    int                `json:"revenueThisMonth"`
	RevenueLastMonth    int                `json:"revenueLastMonth"`
	RevenueCurrency     string             `json:"revenueCurrency"`
	RevenueByMonth      []RevenueByMonth   `json:"revenueByMonth"`
	RevenueByService    []RevenueByService `json:"revenueByService"`
}
