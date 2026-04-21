package changes

import "sync"

/***************************************************************************************************
* Group identifies a frontend cache group changed for a specialist.
***************************************************************************************************/
type Group string

const (
	GroupBookings           Group = "bookings"
	GroupRecurring          Group = "recurring"
	GroupClients            Group = "clients"
	GroupServices           Group = "services"
	GroupClientBatches      Group = "clientBatches"
	GroupWorkingHours       Group = "workingHours"
	GroupDaysOff            Group = "daysOff"
	GroupSpecialist         Group = "specialist"
	GroupClientProfile      Group = "clientProfile"
	GroupAdminNotifications Group = "adminNotifications"
)

var allGroups = []Group{
	GroupBookings,
	GroupRecurring,
	GroupClients,
	GroupServices,
	GroupClientBatches,
	GroupWorkingHours,
	GroupDaysOff,
	GroupSpecialist,
	GroupClientProfile,
	GroupAdminNotifications,
}

var (
	mu       sync.RWMutex
	versions = map[string]map[Group]int64{}
)

/***************************************************************************************************
* Publish increments changed resource group versions for a specialist.
***************************************************************************************************/
func Publish(specialistID string, groups ...Group) {
	if specialistID == "" || len(groups) == 0 {
		return
	}

	mu.Lock()
	defer mu.Unlock()

	specialistVersions := versions[specialistID]
	if specialistVersions == nil {
		specialistVersions = map[Group]int64{}
		versions[specialistID] = specialistVersions
	}

	for _, group := range groups {
		if group == "" {
			continue
		}
		specialistVersions[group]++
	}
}

/***************************************************************************************************
* Snapshot returns all known resource group versions for a specialist.
***************************************************************************************************/
func Snapshot(specialistID string) map[string]int64 {
	mu.RLock()
	defer mu.RUnlock()

	resp := make(map[string]int64, len(allGroups))
	current := versions[specialistID]
	for _, group := range allGroups {
		resp[string(group)] = current[group]
	}
	return resp
}
