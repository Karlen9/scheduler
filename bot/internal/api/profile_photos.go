package api

import (
	"crypto/sha256"
	"encoding/hex"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
	"scheduler-bot/internal/telegram"
)

const telegramProfilePhotoPrefix = "telegram:"

/***************************************************************************************************
* Tunables for the profile-photo re-check cache and the background sync workers.
*
* - telegramProfilePhotoTTL: how long a definitive getUserProfilePhotos answer (photo found, or no
*   photo) is trusted before Telegram is asked again. Also the cadence at which a changed avatar is
*   picked up.
* - telegramProfilePhotoFailureBackoff: shorter pause after a failed lookup/verification so a flaky
*   Telegram API is not hammered on every request.
* - telegramProfilePhotoWorkers: max concurrent Telegram lookups made by background syncs.
* - telegramProfilePhotoMaxPending: max background sync jobs waiting/running; extra jobs are dropped
*   (they are retried by the next request that notices the stale photo).
***************************************************************************************************/
var (
	telegramProfilePhotoTTL            = 12 * time.Hour
	telegramProfilePhotoFailureBackoff = 10 * time.Minute
)

const (
	telegramProfilePhotoWorkers     = 4
	telegramProfilePhotoMaxPending  = 512
	telegramProfilePhotoCacheMaxLen = 20000
)

// telegramProfilePhotoLookupFunc returns the newest profile photo of a user as (file_id,
// file_unique_id). Both are empty when Telegram has no photo for the user.
type telegramProfilePhotoLookupFunc func(botToken string, userID int64) (fileID string, uniqueID string, err error)

var telegramProfilePhotoLookup telegramProfilePhotoLookupFunc = func(botToken string, userID int64) (string, string, error) {
	bot := &telegram.Bot{Token: botToken}
	return bot.GetUserProfilePhoto(userID)
}

// SetTelegramProfilePhotoLookupForTest swaps the Telegram profile-photo lookup used by tests and
// resets the re-check cache so earlier lookups do not leak into the next test.
func SetTelegramProfilePhotoLookupForTest(lookup telegramProfilePhotoLookupFunc) func() {
	previous := telegramProfilePhotoLookup
	if lookup == nil {
		telegramProfilePhotoLookup = func(string, int64) (string, string, error) { return "", "", nil }
	} else {
		telegramProfilePhotoLookup = lookup
	}
	telegramProfilePhotoChecks.reset()
	return func() {
		telegramProfilePhotoLookup = previous
		telegramProfilePhotoChecks.reset()
	}
}

/***************************************************************************************************
* Re-check cache. Remembers, per (bot token, Telegram user), what the last getUserProfilePhotos
* round-trip said so that:
* - an unchanged/absent avatar is not re-queried on every request (negative caching),
* - a changed avatar is detected after the TTL by comparing file_unique_id (only file_id is
*   persisted in the database, so the unique id has to live here).
***************************************************************************************************/
type telegramPhotoCheckState int

const (
	telegramPhotoCheckNone telegramPhotoCheckState = iota
	telegramPhotoCheckFound
	telegramPhotoCheckFailed
)

type telegramPhotoCheckKey struct {
	tokenHash string
	userID    int64
}

type telegramPhotoCheck struct {
	state      telegramPhotoCheckState
	checkedAt  time.Time
	photoValue string // "telegram:<file_id>" when state is found
	uniqueID   string // file_unique_id when state is found
}

type telegramPhotoCheckCache struct {
	mu       sync.Mutex
	entries  map[telegramPhotoCheckKey]telegramPhotoCheck
	inflight map[telegramPhotoCheckKey]struct{}
}

var telegramProfilePhotoChecks = &telegramPhotoCheckCache{
	entries:  map[telegramPhotoCheckKey]telegramPhotoCheck{},
	inflight: map[telegramPhotoCheckKey]struct{}{},
}

// telegramProfilePhotoNow is the clock used by the re-check cache (swappable in tests).
var telegramProfilePhotoNow = time.Now

// SetTelegramProfilePhotoClockForTest replaces the re-check cache clock and returns a restore func.
func SetTelegramProfilePhotoClockForTest(now func() time.Time) func() {
	previous := telegramProfilePhotoNow
	if now == nil {
		telegramProfilePhotoNow = time.Now
	} else {
		telegramProfilePhotoNow = now
	}
	return func() { telegramProfilePhotoNow = previous }
}

// ResetTelegramProfilePhotoCacheForTest forgets every remembered lookup result.
func ResetTelegramProfilePhotoCacheForTest() { telegramProfilePhotoChecks.reset() }

func (c *telegramPhotoCheckCache) reset() {
	c.mu.Lock()
	c.entries = map[telegramPhotoCheckKey]telegramPhotoCheck{}
	c.mu.Unlock()
}

func telegramPhotoCheckKeyFor(botToken string, userID int64) telegramPhotoCheckKey {
	sum := sha256.Sum256([]byte(botToken))
	return telegramPhotoCheckKey{tokenHash: hex.EncodeToString(sum[:8]), userID: userID}
}

func (c *telegramPhotoCheckCache) get(key telegramPhotoCheckKey) (telegramPhotoCheck, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries[key]
	return entry, ok
}

func (c *telegramPhotoCheckCache) set(key telegramPhotoCheckKey, entry telegramPhotoCheck) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.entries) >= telegramProfilePhotoCacheMaxLen {
		cutoff := telegramProfilePhotoNow().Add(-telegramProfilePhotoTTL)
		for k, e := range c.entries {
			if e.checkedAt.Before(cutoff) {
				delete(c.entries, k)
			}
		}
		if len(c.entries) >= telegramProfilePhotoCacheMaxLen {
			c.entries = map[telegramPhotoCheckKey]telegramPhotoCheck{}
		}
	}
	c.entries[key] = entry
}

// fresh reports whether the remembered result is still within its trust window.
func (e telegramPhotoCheck) fresh(now time.Time) bool {
	age := now.Sub(e.checkedAt)
	if e.state == telegramPhotoCheckFailed {
		return age < telegramProfilePhotoFailureBackoff
	}
	return age < telegramProfilePhotoTTL
}

/***************************************************************************************************
* resolveTelegramProfilePhoto asks Telegram (through the re-check cache) for the user's current
* profile photo.
*
* Returns:
* - The photo value to persist ("telegram:<file_id>"), or "" when Telegram has no photo / nothing
*   needs to change (unchanged avatar).
* - definitive: false when the lookup failed (network/API error or unverifiable file), so callers
*   must not clear an existing value on the strength of an empty result.
***************************************************************************************************/
func resolveTelegramProfilePhoto(botToken string, telegramUserID int64, currentPhotoURL string) (string, bool) {
	if botToken == "" || telegramUserID <= 0 {
		return "", true
	}

	key := telegramPhotoCheckKeyFor(botToken, telegramUserID)
	now := telegramProfilePhotoNow()
	previous, hadPrevious := telegramProfilePhotoChecks.get(key)
	if hadPrevious && previous.fresh(now) {
		switch previous.state {
		case telegramPhotoCheckFound:
			return previous.photoValue, true
		case telegramPhotoCheckNone:
			return "", true
		default:
			return "", false
		}
	}

	fileID, uniqueID, err := telegramProfilePhotoLookup(botToken, telegramUserID)
	if err != nil {
		log.Printf("Profile photo: lookup failed for telegram user %d: %v", telegramUserID, err)
		telegramProfilePhotoChecks.set(key, telegramPhotoCheck{state: telegramPhotoCheckFailed, checkedAt: now})
		return "", false
	}
	if fileID == "" {
		log.Printf("Profile photo: telegram user %d has no profile photo", telegramUserID)
		telegramProfilePhotoChecks.set(key, telegramPhotoCheck{state: telegramPhotoCheckNone, checkedAt: now})
		return "", true
	}

	/***************************************************************************************************
	* Same avatar as the last successful check (file_unique_id is stable, file_id may not be): keep the
	* stored value untouched and only extend the trust window.
	***************************************************************************************************/
	if hadPrevious && previous.state == telegramPhotoCheckFound && uniqueID != "" &&
		previous.uniqueID == uniqueID && strings.HasPrefix(currentPhotoURL, telegramProfilePhotoPrefix) {
		previous.checkedAt = now
		telegramProfilePhotoChecks.set(key, previous)
		return "", true
	}

	if !telegramProfilePhotoFileVerifier(botToken, fileID) {
		telegramProfilePhotoChecks.set(key, telegramPhotoCheck{state: telegramPhotoCheckFailed, checkedAt: now})
		return "", false
	}

	value := telegramProfilePhotoPrefix + fileID
	log.Printf("Profile photo: resolved photo for telegram user %d (%s)", telegramUserID, truncateForLog(fileID, 12))
	telegramProfilePhotoChecks.set(key, telegramPhotoCheck{
		state:      telegramPhotoCheckFound,
		checkedAt:  now,
		photoValue: value,
		uniqueID:   uniqueID,
	})
	return value, true
}

/***************************************************************************************************
* telegramProfilePhotoNeedsCheck is the cheap, network-free pre-filter for background syncs: it
* says whether resolveTelegramProfilePhoto could change anything for this stored value.
*
* - A stored HTTP t.me/CDN URL (copied from initData) is already a valid avatar and is refreshed
*   every time its owner opens the app, so it is left alone.
* - Everything else (empty, "telegram:<file_id>", legacy custom value) is checked, but only when the
*   cache has no fresh answer, or the fresh answer differs from what is stored.
***************************************************************************************************/
func telegramProfilePhotoNeedsCheck(botToken string, telegramUserID int64, currentPhotoURL string) bool {
	if botToken == "" || telegramUserID <= 0 {
		return false
	}
	isTelegramFileValue := strings.HasPrefix(currentPhotoURL, telegramProfilePhotoPrefix)
	if currentPhotoURL != "" && !isTelegramFileValue && isTelegramProfilePhotoValue(currentPhotoURL) {
		return false
	}

	entry, ok := telegramProfilePhotoChecks.get(telegramPhotoCheckKeyFor(botToken, telegramUserID))
	if !ok || !entry.fresh(telegramProfilePhotoNow()) {
		return true
	}
	switch entry.state {
	case telegramPhotoCheckFound:
		return currentPhotoURL != entry.photoValue
	case telegramPhotoCheckNone:
		return currentPhotoURL != "" && !isTelegramFileValue
	default:
		return false
	}
}

/***************************************************************************************************
* lookupTelegramProfilePhoto resolves the Telegram profile photo for the requesting user. Profile
* photos come exclusively from Telegram: a current value that is not a Telegram photo (a legacy
* custom upload) is treated as replaceable, never as something to keep.
*
* Returns:
* - The photo value to persist ("" when Telegram has no photo or nothing needs to change).
* - definitive: false when the lookup failed (network/API error), so callers must not clear an
*   existing value on the strength of an empty result.
***************************************************************************************************/
func lookupTelegramProfilePhoto(r *http.Request, botToken string, telegramUserID int64, currentPhotoURL string) (string, bool) {
	/***************************************************************************************************
	* Prefer the HTTP CDN URL from validated initData when present — it loads directly from
	* t.me in the browser, bypassing the token-protected /api/photo proxy, and costs no network call.
	* A stored "telegram:<file_id>" value is governed by the TTL refresh below instead, so the two
	* sources do not overwrite each other on every app launch.
	***************************************************************************************************/
	if photoURL := initDataPhotoURL(r, telegramUserID); photoURL != "" && !strings.HasPrefix(currentPhotoURL, telegramProfilePhotoPrefix) {
		return photoURL, true
	}

	return resolveTelegramProfilePhoto(botToken, telegramUserID, currentPhotoURL)
}

// initDataPhotoURL returns the photo_url from validated initData when the requesting Telegram user
// is the given user, "" otherwise.
func initDataPhotoURL(r *http.Request, telegramUserID int64) string {
	if r == nil {
		return ""
	}
	user := GetTelegramUserFromContext(r)
	if user != nil && user.ID == telegramUserID && user.PhotoURL != "" {
		return user.PhotoURL
	}
	return ""
}

/***************************************************************************************************
* telegramProfilePhotoFileVerifier returns true when the bot can actually download the file_id via
* getFile. Indirected through a package-level variable so tests can stub it without spinning up a
* real Telegram API. Production implementation issues a single getFile round-trip and discards the
* bytes — a few hundred ms once per restore is acceptable to avoid persisting an unloadable
* reference.
***************************************************************************************************/
var telegramProfilePhotoFileVerifier = func(botToken, fileID string) bool {
	bot := &telegram.Bot{Token: botToken}
	if _, _, err := bot.GetFile(fileID); err != nil {
		log.Printf("Telegram profile photo file verification failed for %s: %v", truncateForLog(fileID, 20), err)
		return false
	}
	return true
}

/***************************************************************************************************
* SetTelegramProfilePhotoFileVerifierForTest replaces the bot-API fileID verifier used by
* resolveTelegramProfilePhoto. Returns a function that restores the previous value.
***************************************************************************************************/
func SetTelegramProfilePhotoFileVerifierForTest(verifier func(botToken, fileID string) bool) func() {
	previous := telegramProfilePhotoFileVerifier
	if verifier == nil {
		telegramProfilePhotoFileVerifier = func(string, string) bool { return true }
	} else {
		telegramProfilePhotoFileVerifier = verifier
	}
	return func() {
		telegramProfilePhotoFileVerifier = previous
	}
}

func isTelegramProfilePhotoValue(photoURL string) bool {
	if strings.HasPrefix(photoURL, telegramProfilePhotoPrefix) {
		return true
	}
	if !strings.HasPrefix(photoURL, "http") {
		return false
	}

	parsed, err := url.Parse(photoURL)
	if err != nil {
		return false
	}
	hostname := parsed.Hostname()
	return hostname == "t.me" ||
		hostname == "telegram.org" ||
		strings.HasSuffix(hostname, ".telegram.org") ||
		strings.HasSuffix(hostname, ".telegram-cdn.org") ||
		strings.HasSuffix(hostname, ".cdn-telegram.org")
}

/***************************************************************************************************
* applyClientTelegramPhoto persists a lookup result for a client and mutates the passed struct.
* Returns true when the stored photo changed.
***************************************************************************************************/
func applyClientTelegramPhoto(client *models.Client, photoURL string, definitive bool) bool {
	if photoURL == "" {
		/***************************************************************************************************
		* Telegram has no photo: drop any legacy non-Telegram value so the avatar falls back to initials.
		***************************************************************************************************/
		if definitive && client.PhotoURL != "" && !isTelegramProfilePhotoValue(client.PhotoURL) {
			if err := db.UpdateClientPhoto(client.ID, ""); err != nil {
				log.Printf("Error clearing client custom photo: %v", err)
				return false
			}
			log.Printf("Profile photo: cleared legacy photo of client %s", client.ID)
			client.PhotoURL = ""
			return true
		}
		return false
	}
	if photoURL == client.PhotoURL {
		return false
	}

	if err := db.UpdateClientPhoto(client.ID, photoURL); err != nil {
		log.Printf("Error updating client Telegram photo: %v", err)
		return false
	}
	log.Printf("Profile photo: updated photo of client %s", client.ID)
	client.PhotoURL = photoURL
	return true
}

/***************************************************************************************************
* applySpecialistTelegramPhoto persists a lookup result for a specialist and mutates the passed
* struct. The Telegram photo always wins: legacy custom uploads are replaced and the old
* photo_removed flag is ignored (and reset by UpdateSpecialistPhoto). Returns true on change.
***************************************************************************************************/
func applySpecialistTelegramPhoto(specialist *models.Specialist, photoURL string, definitive bool) bool {
	if photoURL == "" {
		if definitive && specialist.PhotoURL != "" && !isTelegramProfilePhotoValue(specialist.PhotoURL) {
			if err := db.UpdateSpecialistPhoto(specialist.ID, ""); err != nil {
				log.Printf("Error clearing specialist custom photo: %v", err)
				return false
			}
			log.Printf("Profile photo: cleared legacy photo of specialist %s", specialist.ID)
			specialist.PhotoURL = ""
			return true
		}
		return false
	}
	if photoURL == specialist.PhotoURL {
		return false
	}

	if err := db.UpdateSpecialistPhoto(specialist.ID, photoURL); err != nil {
		log.Printf("Error updating specialist Telegram photo: %v", err)
		return false
	}
	log.Printf("Profile photo: updated photo of specialist %s", specialist.ID)
	specialist.PhotoURL = photoURL
	return true
}

// ensureClientTelegramProfilePhoto synchronously syncs the client's photo (used by the explicit
// profile endpoint). Returns true when the stored photo changed.
func ensureClientTelegramProfilePhoto(r *http.Request, client *models.Client, specialist *models.Specialist) bool {
	if client == nil || specialist == nil {
		return false
	}
	photoURL, definitive := lookupTelegramProfilePhoto(r, specialist.BotToken, client.TelegramUserID, client.PhotoURL)
	return applyClientTelegramPhoto(client, photoURL, definitive)
}

// ensureSpecialistTelegramProfilePhoto synchronously syncs the specialist's photo with Telegram.
// Returns true when the stored photo changed.
func ensureSpecialistTelegramProfilePhoto(r *http.Request, specialist *models.Specialist) bool {
	if specialist == nil {
		return false
	}
	photoURL, definitive := lookupTelegramProfilePhoto(r, specialist.BotToken, specialist.TelegramUserID, specialist.PhotoURL)
	return applySpecialistTelegramPhoto(specialist, photoURL, definitive)
}

/***************************************************************************************************
* Background photo sync. Telegram lookups never run on the request path: callers describe what to
* check as jobs and the scheduler runs them in goroutines bounded by a small worker semaphore,
* deduplicated per (bot, Telegram user), and publishes one change event afterwards when anything
* was written so open UIs refresh.
***************************************************************************************************/
var (
	telegramPhotoSyncSlots   = make(chan struct{}, telegramProfilePhotoWorkers)
	telegramPhotoSyncPending atomic.Int32
	telegramPhotoSyncWG      sync.WaitGroup
)

// telegramPhotoSyncTarget is one stored photo (client row or specialist row) fed by a job.
type telegramPhotoSyncTarget struct {
	current string
	apply   func(photoURL string, definitive bool) bool
	groups  []changes.Group
}

// telegramPhotoSyncJob checks one Telegram user and updates every target that stores their photo.
type telegramPhotoSyncJob struct {
	botToken       string
	telegramUserID int64
	targets        []telegramPhotoSyncTarget
}

// clientPhotoSyncJob builds a job for a client row; apply works on a private copy so the request's
// own client struct is never mutated from a goroutine.
func clientPhotoSyncJob(botToken string, client *models.Client) (telegramPhotoSyncJob, bool) {
	if client == nil || client.IsGhost || client.TelegramUserID <= 0 {
		return telegramPhotoSyncJob{}, false
	}
	snapshot := *client
	return telegramPhotoSyncJob{
		botToken:       botToken,
		telegramUserID: client.TelegramUserID,
		targets: []telegramPhotoSyncTarget{{
			current: snapshot.PhotoURL,
			apply: func(photoURL string, definitive bool) bool {
				return applyClientTelegramPhoto(&snapshot, photoURL, definitive)
			},
			groups: []changes.Group{changes.GroupClients, changes.GroupClientProfile, changes.GroupBookings},
		}},
	}, true
}

// specialistPhotoSyncTarget builds the target for the specialist's own photo.
func specialistPhotoSyncTarget(specialist *models.Specialist) telegramPhotoSyncTarget {
	snapshot := *specialist
	return telegramPhotoSyncTarget{
		current: snapshot.PhotoURL,
		apply: func(photoURL string, definitive bool) bool {
			return applySpecialistTelegramPhoto(&snapshot, photoURL, definitive)
		},
		groups: []changes.Group{changes.GroupSpecialist},
	}
}

func (c *telegramPhotoCheckCache) claim(key telegramPhotoCheckKey) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, busy := c.inflight[key]; busy {
		return false
	}
	c.inflight[key] = struct{}{}
	return true
}

func (c *telegramPhotoCheckCache) release(key telegramPhotoCheckKey) {
	c.mu.Lock()
	delete(c.inflight, key)
	c.mu.Unlock()
}

/***************************************************************************************************
* scheduleTelegramPhotoSync drops jobs that cannot change anything (cache says so), claims the rest
* and runs them in the background. It returns immediately and never blocks the caller.
***************************************************************************************************/
func scheduleTelegramPhotoSync(specialistID string, jobs ...telegramPhotoSyncJob) {
	type claimedJob struct {
		job telegramPhotoSyncJob
		key telegramPhotoCheckKey
	}

	var claimed []claimedJob
	for _, job := range jobs {
		var targets []telegramPhotoSyncTarget
		for _, target := range job.targets {
			if telegramProfilePhotoNeedsCheck(job.botToken, job.telegramUserID, target.current) {
				targets = append(targets, target)
			}
		}
		if len(targets) == 0 {
			continue
		}
		job.targets = targets
		key := telegramPhotoCheckKeyFor(job.botToken, job.telegramUserID)
		if !telegramProfilePhotoChecks.claim(key) {
			continue
		}
		claimed = append(claimed, claimedJob{job: job, key: key})
	}
	if len(claimed) == 0 {
		return
	}

	if int(telegramPhotoSyncPending.Add(1)) > telegramProfilePhotoMaxPending {
		telegramPhotoSyncPending.Add(-1)
		for _, c := range claimed {
			telegramProfilePhotoChecks.release(c.key)
		}
		return
	}

	telegramPhotoSyncWG.Add(1)
	go func() {
		defer telegramPhotoSyncWG.Done()
		defer telegramPhotoSyncPending.Add(-1)

		var (
			workers sync.WaitGroup
			mu      sync.Mutex
			groups  = map[changes.Group]struct{}{}
		)
		for _, c := range claimed {
			workers.Add(1)
			go func(c claimedJob) {
				defer workers.Done()
				defer telegramProfilePhotoChecks.release(c.key)
				defer func() {
					if rec := recover(); rec != nil {
						log.Printf("Profile photo: sync panic for telegram user %d: %v", c.job.telegramUserID, rec)
					}
				}()

				telegramPhotoSyncSlots <- struct{}{}
				defer func() { <-telegramPhotoSyncSlots }()

				for _, target := range c.job.targets {
					photoURL, definitive := resolveTelegramProfilePhoto(c.job.botToken, c.job.telegramUserID, target.current)
					if target.apply(photoURL, definitive) {
						mu.Lock()
						for _, g := range target.groups {
							groups[g] = struct{}{}
						}
						mu.Unlock()
					}
				}
			}(c)
		}
		workers.Wait()

		if len(groups) > 0 {
			changed := make([]changes.Group, 0, len(groups))
			for g := range groups {
				changed = append(changed, g)
			}
			changes.Publish(specialistID, changed...)
		}
	}()
}

// WaitForTelegramProfilePhotoSyncForTest blocks until every scheduled background photo sync is done.
func WaitForTelegramProfilePhotoSyncForTest() { telegramPhotoSyncWG.Wait() }

// SyncClientTelegramProfilePhotoAsync refreshes a client's Telegram photo in the background. It is
// the entry point for the specialist bot (which cannot import this package directly).
func SyncClientTelegramProfilePhotoAsync(botToken, specialistID string, client *models.Client) {
	if job, ok := clientPhotoSyncJob(botToken, client); ok {
		scheduleTelegramPhotoSync(specialistID, job)
	}
}

// backfillClientTelegramPhotos schedules background syncs for the given clients (admin list).
func backfillClientTelegramPhotos(specialist *models.Specialist, clients []models.Client) {
	if specialist == nil || specialist.BotToken == "" {
		return
	}
	jobs := make([]telegramPhotoSyncJob, 0, len(clients))
	for i := range clients {
		if job, ok := clientPhotoSyncJob(specialist.BotToken, &clients[i]); ok {
			jobs = append(jobs, job)
		}
	}
	if len(jobs) > 0 {
		scheduleTelegramPhotoSync(specialist.ID, jobs...)
	}
}

/***************************************************************************************************
* syncRequestingUserPhotos is called from the auth middleware for every authenticated request.
* Cheap parts run inline: adopting the initData photo_url (a plain DB write) and the cache pre-check.
* The Telegram round-trip, when the cache says one is due, runs in the background.
***************************************************************************************************/
func syncRequestingUserPhotos(specialist *models.Specialist, client *models.Client, user *TelegramUser) {
	if specialist == nil || user == nil {
		return
	}
	isOwner := user.ID == specialist.TelegramUserID

	if user.PhotoURL != "" {
		if client != nil && !client.IsGhost && client.PhotoURL != user.PhotoURL &&
			!strings.HasPrefix(client.PhotoURL, telegramProfilePhotoPrefix) {
			if err := db.UpdateClientPhoto(client.ID, user.PhotoURL); err == nil {
				client.PhotoURL = user.PhotoURL
				changes.Publish(specialist.ID, changes.GroupClients, changes.GroupClientProfile, changes.GroupBookings)
			}
		}
		if isOwner && specialist.PhotoURL != user.PhotoURL &&
			!strings.HasPrefix(specialist.PhotoURL, telegramProfilePhotoPrefix) {
			if err := db.UpdateSpecialistPhoto(specialist.ID, user.PhotoURL); err == nil {
				specialist.PhotoURL = user.PhotoURL
				changes.Publish(specialist.ID, changes.GroupSpecialist)
			}
		}
	}

	job := telegramPhotoSyncJob{botToken: specialist.BotToken, telegramUserID: user.ID}
	if client != nil && !client.IsGhost {
		if clientJob, ok := clientPhotoSyncJob(specialist.BotToken, client); ok {
			job.targets = append(job.targets, clientJob.targets...)
		}
	}
	if isOwner {
		job.targets = append(job.targets, specialistPhotoSyncTarget(specialist))
	}
	if len(job.targets) > 0 {
		scheduleTelegramPhotoSync(specialist.ID, job)
	}
}
