package api_test

import (
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"scheduler-bot/internal/api"
	"scheduler-bot/internal/db"
)

/***************************************************************************************************
* photoLookupRecorder stubs the Telegram lookup, records which users were queried and lets each test
* script the answer. Installing it also resets the re-check cache and the file verifier.
***************************************************************************************************/
type photoLookupRecorder struct {
	mu      sync.Mutex
	calls   map[int64]int
	fileID  string
	uniqID  string
	lookups atomic.Int32
}

func installPhotoLookup(t *testing.T, fileID, uniqueID string) *photoLookupRecorder {
	t.Helper()
	rec := &photoLookupRecorder{calls: map[int64]int{}, fileID: fileID, uniqID: uniqueID}
	restore := api.SetTelegramProfilePhotoLookupForTest(func(_ string, userID int64) (string, string, error) {
		rec.mu.Lock()
		defer rec.mu.Unlock()
		rec.calls[userID]++
		rec.lookups.Add(1)
		return rec.fileID, rec.uniqID, nil
	})
	restoreVerifier := api.SetTelegramProfilePhotoFileVerifierForTest(nil)
	t.Cleanup(func() {
		restoreVerifier()
		restore()
	})
	return rec
}

func (r *photoLookupRecorder) set(fileID, uniqueID string) {
	r.mu.Lock()
	r.fileID, r.uniqID = fileID, uniqueID
	r.mu.Unlock()
}

func (r *photoLookupRecorder) callsFor(userID int64) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.calls[userID]
}

func clientPhoto(t *testing.T, telegramUserID int64) string {
	t.Helper()
	client, err := db.GetClientByTelegramID(telegramUserID, testSpecialist.ID)
	if err != nil || client == nil {
		t.Fatalf("expected client %d, err=%v", telegramUserID, err)
	}
	return client.PhotoURL
}

/***************************************************************************************************
* A client who never opens the Profile tab still gets a Telegram photo from any authenticated call.
***************************************************************************************************/
func TestClientPhotoSyncedByNormalAuthenticatedRequest(t *testing.T) {
	rec := installPhotoLookup(t, "client_file_1", "client_uniq_1")
	const userID int64 = 7000001

	w := doClientRequest(t, http.MethodGet, "/api/specialist", nil, userID)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	api.WaitForTelegramProfilePhotoSyncForTest()

	if got := clientPhoto(t, userID); got != "telegram:client_file_1" {
		t.Fatalf("expected telegram photo stored, got %q", got)
	}
	if rec.callsFor(userID) != 1 {
		t.Fatalf("expected exactly one lookup, got %d", rec.callsFor(userID))
	}

	// Once stored and fresh, further requests do not query Telegram again.
	doClientRequest(t, http.MethodGet, "/api/specialist", nil, userID)
	api.WaitForTelegramProfilePhotoSyncForTest()
	if rec.callsFor(userID) != 1 {
		t.Fatalf("expected no second lookup within TTL, got %d", rec.callsFor(userID))
	}
}

/***************************************************************************************************
* initData photo_url is adopted inline (no Telegram round-trip).
***************************************************************************************************/
func TestClientPhotoFromInitDataAdoptedWithoutLookup(t *testing.T) {
	rec := installPhotoLookup(t, "", "")
	const userID int64 = 7000002

	doClientRequestWithPhoto(t, http.MethodGet, "/api/specialist", nil, userID, "https://t.me/i/userpic/320/initdata.jpg")
	if got := clientPhoto(t, userID); got != "https://t.me/i/userpic/320/initdata.jpg" {
		t.Fatalf("expected initData photo stored synchronously, got %q", got)
	}
	api.WaitForTelegramProfilePhotoSyncForTest()
	if rec.callsFor(userID) != 0 {
		t.Fatalf("expected no Telegram lookup for an http t.me photo, got %d", rec.callsFor(userID))
	}
}

/***************************************************************************************************
* Telegram having no photo is remembered so it is not re-queried on every request.
***************************************************************************************************/
func TestClientPhotoNegativeResultIsCached(t *testing.T) {
	rec := installPhotoLookup(t, "", "")
	const userID int64 = 7000003

	for i := 0; i < 3; i++ {
		doClientRequest(t, http.MethodGet, "/api/specialist", nil, userID)
		api.WaitForTelegramProfilePhotoSyncForTest()
	}
	if rec.callsFor(userID) != 1 {
		t.Fatalf("expected a single lookup thanks to the negative cache, got %d", rec.callsFor(userID))
	}
	if got := clientPhoto(t, userID); got != "" {
		t.Fatalf("expected no photo, got %q", got)
	}
}

/***************************************************************************************************
* After the TTL a stored telegram: photo is re-checked: replaced when the avatar's unique id changed,
* left untouched when it did not.
***************************************************************************************************/
func TestClientPhotoRefreshedAfterTTLOnlyWhenAvatarChanged(t *testing.T) {
	rec := installPhotoLookup(t, "old_file", "uniq_old")
	const userID int64 = 7000004

	now := time.Now()
	restoreClock := api.SetTelegramProfilePhotoClockForTest(func() time.Time { return now })
	defer restoreClock()

	request := func() {
		doClientRequest(t, http.MethodGet, "/api/specialist", nil, userID)
		api.WaitForTelegramProfilePhotoSyncForTest()
	}

	request()
	if got := clientPhoto(t, userID); got != "telegram:old_file" {
		t.Fatalf("expected initial photo, got %q", got)
	}

	// Within the TTL nothing is re-queried even if Telegram would now answer differently.
	rec.set("new_file", "uniq_new")
	now = now.Add(time.Hour)
	request()
	if rec.callsFor(userID) != 1 || clientPhoto(t, userID) != "telegram:old_file" {
		t.Fatalf("expected no re-check within TTL, calls=%d photo=%q", rec.callsFor(userID), clientPhoto(t, userID))
	}

	// Past the TTL, a different unique id replaces the stored photo.
	now = now.Add(13 * time.Hour)
	request()
	if rec.callsFor(userID) != 2 {
		t.Fatalf("expected a re-check after TTL, got %d lookups", rec.callsFor(userID))
	}
	if got := clientPhoto(t, userID); got != "telegram:new_file" {
		t.Fatalf("expected changed avatar to be stored, got %q", got)
	}

	// Past the TTL again, same unique id (different file_id) leaves the stored value alone.
	rec.set("same_avatar_other_file_id", "uniq_new")
	now = now.Add(13 * time.Hour)
	request()
	if rec.callsFor(userID) != 3 {
		t.Fatalf("expected another re-check after TTL, got %d lookups", rec.callsFor(userID))
	}
	if got := clientPhoto(t, userID); got != "telegram:new_file" {
		t.Fatalf("expected unchanged avatar to be left untouched, got %q", got)
	}
}

/***************************************************************************************************
* The admin clients list backfills missing photos in the background and skips ghost clients.
***************************************************************************************************/
func TestAdminClientsListBackfillsPhotosAndSkipsGhosts(t *testing.T) {
	rec := installPhotoLookup(t, "backfill_file", "backfill_uniq")

	const realUserID int64 = 7000005
	real, err := db.GetOrCreateClient(realUserID, testSpecialist.ID, "BackfillReal")
	if err != nil {
		t.Fatalf("create client: %v", err)
	}
	ghost, err := db.CreateGhostClient(testSpecialist.ID, "BackfillGhost")
	if err != nil {
		t.Fatalf("create ghost: %v", err)
	}

	w := doAdminRequest(t, http.MethodGet, "/api/admin/clients?search=Backfill", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "BackfillGhost") {
		t.Fatalf("expected ghost in list: %s", w.Body.String())
	}
	api.WaitForTelegramProfilePhotoSyncForTest()

	if got := clientPhoto(t, realUserID); got != "telegram:backfill_file" {
		t.Fatalf("expected backfilled photo for real client, got %q", got)
	}
	reloaded, err := db.GetClientByID(real.ID)
	if err != nil || reloaded == nil || reloaded.PhotoURL != "telegram:backfill_file" {
		t.Fatalf("expected persisted photo, err=%v client=%+v", err, reloaded)
	}

	rec.mu.Lock()
	defer rec.mu.Unlock()
	for userID := range rec.calls {
		if userID < 0 {
			t.Fatalf("ghost client (telegram id %d) must not be looked up", userID)
		}
	}
	if latest, _ := db.GetClientByID(ghost.ID); latest == nil || latest.PhotoURL != "" {
		t.Fatalf("ghost client photo must stay empty, got %+v", latest)
	}
}

/***************************************************************************************************
* The specialist's own photo is synced from the auth path, not only from /api/admin/profile.
***************************************************************************************************/
func TestSpecialistPhotoSyncedByNormalAuthenticatedRequest(t *testing.T) {
	installPhotoLookup(t, "owner_file", "owner_uniq")
	if err := db.UpdateSpecialistPhoto(testSpecialist.ID, ""); err != nil {
		t.Fatalf("reset photo: %v", err)
	}
	defer db.UpdateSpecialistPhoto(testSpecialist.ID, "")

	// An endpoint that does not touch the photo itself; the search matches no client so the list
	// backfill stays out of the way.
	w := doAdminRequest(t, http.MethodGet, "/api/admin/clients?search=no-such-client-zzz", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	api.WaitForTelegramProfilePhotoSyncForTest()

	specialist, err := db.GetSpecialistByID(testSpecialist.ID)
	if err != nil || specialist == nil {
		t.Fatalf("expected specialist, err=%v", err)
	}
	if specialist.PhotoURL != "telegram:owner_file" {
		t.Fatalf("expected specialist photo synced from auth path, got %q", specialist.PhotoURL)
	}
}
