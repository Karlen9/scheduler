package api

/***************************************************************************************************
* SetRouteRateLimitsDisabledForTest toggles the per-route limits for routers built afterwards
* (NewRouter reads the flag once) and returns the previous value so callers can restore it.
***************************************************************************************************/
func SetRouteRateLimitsDisabledForTest(disabled bool) (previous bool) {
	previous = routeRateLimitsDisabled
	routeRateLimitsDisabled = disabled
	return previous
}
