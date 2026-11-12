package telegram

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

func TestExtractRoomPayload(t *testing.T) {
	tests := []struct {
		text, room, ref string
	}{
		{"/start room_abc123", "abc123", ""},
		{"/start  room_abc123 ", "abc123", ""},
		{"/start ref_xyz", "", "xyz"},
		{"/start", "", ""},
		{"/start other_1", "", ""},
		{"/start room_", "", ""},
	}
	for _, tt := range tests {
		if got := extractRoomPayload(tt.text); got != tt.room {
			t.Errorf("extractRoomPayload(%q) = %q, want %q", tt.text, got, tt.room)
		}
		if got := extractRefPayload(tt.text); got != tt.ref {
			t.Errorf("extractRefPayload(%q) = %q, want %q (ref_ parsing must keep working)", tt.text, got, tt.ref)
		}
	}
}

type roomBotFixture struct {
	a, b, c   *models.Specialist
	roomID    string
	memberA   string
	memberB   string
	transport *recordingTransport
}

func futureDay(offset int) string {
	return time.Now().UTC().AddDate(0, 0, offset).Format("2006-01-02")
}

func newRoomBotFixture(t *testing.T) *roomBotFixture {
	t.Helper()
	setupMasterSupportTestDB(t)
	f := &roomBotFixture{transport: &recordingTransport{}}
	previous := http.DefaultTransport
	http.DefaultTransport = f.transport
	t.Cleanup(func() { http.DefaultTransport = previous })

	var err error
	if f.a, err = db.CreateSpecialist(9201, "room-bot-token-a", "roomabot", "Anna", "UTC", 24); err != nil {
		t.Fatal(err)
	}
	if f.b, err = db.CreateSpecialist(9202, "room-bot-token-b", "roombbot", "Boris", "UTC", 24); err != nil {
		t.Fatal(err)
	}
	if f.c, err = db.CreateSpecialist(9203, "room-bot-token-c", "roomcbot", "Clara", "UTC", 24); err != nil {
		t.Fatal(err)
	}
	room, err := db.CreateRoom(f.a.ID, "Lenina")
	if err != nil {
		t.Fatal(err)
	}
	f.roomID = room.ID
	view, _ := db.GetRoomForSpecialist(f.a.ID)
	f.memberA = view.MeMember.ID
	offline, _ := db.AddOfflineMember(room.ID, "Boris", "violet", true)
	if _, err := db.JoinRoomByInvite(offline.InviteCode, f.b.ID); err != nil {
		t.Fatal(err)
	}
	f.memberB = offline.ID
	return f
}

func (f *roomBotFixture) calls(pathPart string) []recordedRequest {
	var out []recordedRequest
	for _, c := range f.transport.calls {
		if strings.Contains(c.path, pathPart) {
			out = append(out, c)
		}
	}
	return out
}

func TestNotifyRoomDayRequestSendsGiveDeclineButtons(t *testing.T) {
	f := newRoomBotFixture(t)
	h := &Handler{Bot: &Bot{Token: "room-bot-token-a"}}

	date := time.Date(2030, 11, 21, 0, 0, 0, 0, time.UTC) // a Thursday
	if err := h.NotifyRoomDayRequest(f.a, "Boris", "Lenina", date, "req-123"); err != nil {
		t.Fatal(err)
	}
	sent := f.calls("sendMessage")
	if len(sent) != 1 {
		t.Fatalf("expected one message, got %d", len(sent))
	}
	body := sent[0].body
	for _, want := range []string{"Boris", "Lenina", "чт, 21 ноября", `"callback_data":"rdr_ok:req-123"`, `"callback_data":"rdr_no:req-123"`, "Отдать", "Отказать"} {
		if !strings.Contains(body, want) {
			t.Fatalf("message should contain %q, got %s", want, body)
		}
	}
}

func TestRoomRequestCallbackOwnershipAndResults(t *testing.T) {
	f := newRoomBotFixture(t)
	day := futureDay(30)
	if _, err := db.AssignRoomDays(f.a.ID, []db.RoomDayAssign{{Date: mustDate(t, day), MemberID: f.memberA}}); err != nil {
		t.Fatal(err)
	}
	request, _, err := db.CreateDayRequest(f.b.ID, mustDate(t, day))
	if err != nil {
		t.Fatal(err)
	}

	var resolvedHook []bool
	previous := OnRoomRequestResolved
	OnRoomRequestResolved = func(r *models.RoomDayRequest, accepted bool) { resolvedHook = append(resolvedHook, accepted) }
	defer func() { OnRoomRequestResolved = previous }()

	press := func(botToken string, fromTG int64, data string) {
		h := &Handler{Bot: &Bot{Token: botToken}}
		h.handleCallbackQuery(Update{CallbackQuery: &CallbackQuery{
			ID: "cb1", From: User{ID: fromTG}, Data: data,
			Message: &Message{MessageID: 7, Chat: Chat{ID: fromTG}},
		}})
	}
	status := func() string {
		got, _ := db.GetRoomDayRequest(request.ID)
		return got.Status
	}

	// The requester (B) pressing "give" on A's bot, a stranger, and A pressing on B's bot: all ignored.
	press("room-bot-token-a", f.b.TelegramUserID, "rdr_ok:"+request.ID)
	press("room-bot-token-a", 555555, "rdr_ok:"+request.ID)
	press("room-bot-token-b", f.a.TelegramUserID, "rdr_ok:"+request.ID)
	if status() != models.RoomRequestPending || len(resolvedHook) != 0 {
		t.Fatalf("foreign presses must not resolve the request (status %s)", status())
	}
	// Bookings block "give": callback answered with the hint, buttons stay (no edit), still pending.
	client, _ := db.CreateGhostClient(f.a.ID, "Ghost")
	service, _ := db.CreateSessionType(f.a.ID, "common", "S", 60, 0, "RUB", "")
	start := mustDate(t, day).Add(10 * time.Hour)
	booking, err := db.CreateBooking(f.a.ID, client.ID, service.ID, start, start.Add(time.Hour), "Ghost", "", 60)
	if err != nil {
		t.Fatal(err)
	}
	f.transport.calls = nil
	press("room-bot-token-a", f.a.TelegramUserID, "rdr_ok:"+request.ID)
	if status() != models.RoomRequestPending {
		t.Fatalf("a booked day must keep the request pending, got %s", status())
	}
	answers := f.calls("answerCallbackQuery")
	if len(answers) != 1 || !strings.Contains(answers[0].body, "Сначала перенесите записи на этот день") {
		t.Fatalf("expected the move-bookings hint, got %+v", answers)
	}
	if len(f.calls("editMessageText")) != 0 {
		t.Fatal("buttons must stay: the message must not be edited")
	}

	// Without bookings the owner can give the day: ownership moves, message edited, requester hook fires.
	if _, err := db.DB.Exec(db.Q(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`), booking.ID); err != nil {
		t.Fatal(err)
	}
	f.transport.calls = nil
	press("room-bot-token-a", f.a.TelegramUserID, "rdr_ok:"+request.ID)
	if status() != models.RoomRequestAccepted {
		t.Fatalf("expected accepted, got %s", status())
	}
	if owner, _ := db.GetRoomMemberByID(f.memberB); owner == nil {
		t.Fatal("member B vanished")
	}
	edits := f.calls("editMessageText")
	if len(edits) != 1 || !strings.Contains(edits[0].body, "Вы отдали") || !strings.Contains(edits[0].body, "(получатель: Boris)") || strings.Contains(edits[0].body, "reply_markup") {
		t.Fatalf("message must be edited to the result without buttons, got %+v", edits)
	}
	if len(resolvedHook) != 1 || !resolvedHook[0] {
		t.Fatalf("requester notification hook expected once with accepted=true, got %v", resolvedHook)
	}

	// Pressing again reports "already handled" and does not re-fire the hook.
	f.transport.calls = nil
	press("room-bot-token-a", f.a.TelegramUserID, "rdr_ok:"+request.ID)
	if len(resolvedHook) != 1 {
		t.Fatalf("a repeated press must not notify again: %v", resolvedHook)
	}
}

func TestRoomRequestCallbackDecline(t *testing.T) {
	f := newRoomBotFixture(t)
	day := futureDay(40)
	if _, err := db.AssignRoomDays(f.a.ID, []db.RoomDayAssign{{Date: mustDate(t, day), MemberID: f.memberA}}); err != nil {
		t.Fatal(err)
	}
	request, _, _ := db.CreateDayRequest(f.b.ID, mustDate(t, day))

	var accepted *bool
	previous := OnRoomRequestResolved
	OnRoomRequestResolved = func(r *models.RoomDayRequest, a bool) { accepted = &a }
	defer func() { OnRoomRequestResolved = previous }()

	h := &Handler{Bot: &Bot{Token: "room-bot-token-a"}}
	h.handleCallbackQuery(Update{CallbackQuery: &CallbackQuery{
		ID: "cb", From: User{ID: f.a.TelegramUserID}, Data: "rdr_no:" + request.ID,
		Message: &Message{MessageID: 9, Chat: Chat{ID: f.a.TelegramUserID}},
	}})
	got, _ := db.GetRoomDayRequest(request.ID)
	if got.Status != models.RoomRequestDeclined || accepted == nil || *accepted {
		t.Fatalf("decline failed: status %s hook %v", got.Status, accepted)
	}
	if edits := f.calls("editMessageText"); len(edits) != 1 || !strings.Contains(edits[0].body, "Вы отклонили запрос на") {
		t.Fatalf("expected the decline text, got %+v", edits)
	}
}

func mustDate(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := time.Parse("2006-01-02", s)
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func newMasterForRooms() *MasterHandler {
	return NewMasterHandler(&Bot{ID: 9000, Token: "master-token"}, "https://api.example.com", "https://app.example.com", nil, 0)
}

func TestMasterStartRoomInviteForExistingSpecialist(t *testing.T) {
	f := newRoomBotFixture(t)
	offline, _ := db.AddOfflineMember(f.roomID, "Clara", "teal", true)
	master := newMasterForRooms()
	loc := myI18n.NewLocalizer("ru")

	var joined []string
	previous := OnRoomMemberJoined
	OnRoomMemberJoined = func(roomID, specialistID string) { joined = append(joined, roomID+"|"+specialistID) }
	defer func() { OnRoomMemberJoined = previous }()

	f.transport.calls = nil
	master.handleCommand(f.c.TelegramUserID, f.c.TelegramUserID, "/start room_"+offline.InviteCode, loc)
	sent := f.calls("sendMessage")
	if len(sent) != 1 {
		t.Fatalf("expected one invitation message, got %d", len(sent))
	}
	for _, want := range []string{"приглашает вас в «Lenina»", "Anna", "m:room:acc:" + offline.InviteCode, "m:room:dec:" + offline.InviteCode} {
		if !strings.Contains(sent[0].body, want) {
			t.Fatalf("invitation should contain %q: %s", want, sent[0].body)
		}
	}
	if view, _ := db.GetRoomForSpecialist(f.c.ID); view != nil {
		t.Fatal("nothing may be joined before accepting")
	}

	// Decline leaves everything untouched.
	master.dispatchCallback(&CallbackQuery{ID: "d", From: User{ID: f.c.TelegramUserID}, Data: "m:room:dec:" + offline.InviteCode,
		Message: &Message{MessageID: 3, Chat: Chat{ID: f.c.TelegramUserID}}})
	if view, _ := db.GetRoomForSpecialist(f.c.ID); view != nil {
		t.Fatal("decline must not join")
	}

	// Accept joins and notifies the others.
	master.dispatchCallback(&CallbackQuery{ID: "a", From: User{ID: f.c.TelegramUserID}, Data: "m:room:acc:" + offline.InviteCode,
		Message: &Message{MessageID: 3, Chat: Chat{ID: f.c.TelegramUserID}}})
	view, _ := db.GetRoomForSpecialist(f.c.ID)
	if view == nil || view.Room.ID != f.roomID {
		t.Fatal("accept must join the room")
	}
	if len(joined) != 1 || joined[0] != f.roomID+"|"+f.c.ID {
		t.Fatalf("join hook expected once, got %v", joined)
	}
	if edits := f.calls("editMessageText"); len(edits) == 0 || !strings.Contains(edits[len(edits)-1].body, "Вы теперь в «Lenina»") {
		t.Fatalf("expected the result message, got %+v", edits)
	}

	// The used code is now invalid; a member of a room gets the explanation instead of buttons.
	f.transport.calls = nil
	master.handleCommand(f.c.TelegramUserID, f.c.TelegramUserID, "/start room_"+offline.InviteCode, loc)
	if sent := f.calls("sendMessage"); len(sent) == 0 || !strings.Contains(sent[0].body, "недействительно") {
		t.Fatalf("used invite should be reported invalid: %+v", sent)
	}
}

func TestMasterStartRoomInviteAlreadyInRoom(t *testing.T) {
	f := newRoomBotFixture(t)
	other, _ := db.AddOfflineMember(f.roomID, "Spare", "teal", true)
	if _, err := db.CreateRoom(f.c.ID, "Own"); err != nil {
		t.Fatal(err)
	}
	master := newMasterForRooms()

	f.transport.calls = nil
	master.handleCommand(f.c.TelegramUserID, f.c.TelegramUserID, "/start room_"+other.InviteCode, myI18n.NewLocalizer("ru"))
	sent := f.calls("sendMessage")
	if len(sent) != 1 || !strings.Contains(sent[0].body, "сначала выйдите") || strings.Contains(sent[0].body, "m:room:acc:") {
		t.Fatalf("already-in-room explanation expected without buttons, got %+v", sent)
	}
}

func TestMasterRoomInviteForNewSpecialistJoinsAfterOnboarding(t *testing.T) {
	if requireOnboardingConsent {
		t.Skip("consent step is enabled")
	}
	f := newRoomBotFixture(t)
	offline, _ := db.AddOfflineMember(f.roomID, "Newbie", "pink", true)
	master := newMasterForRooms()
	loc := myI18n.NewLocalizer("ru")

	previousHook := OnSpecialistCreated
	OnSpecialistCreated = nil
	defer func() { OnSpecialistCreated = previousHook }()
	var joined []string
	previousJoin := OnRoomMemberJoined
	OnRoomMemberJoined = func(roomID, specialistID string) { joined = append(joined, specialistID) }
	defer func() { OnRoomMemberJoined = previousJoin }()

	const newcomer = int64(990001)
	f.transport.calls = nil
	master.handleCommand(newcomer, newcomer, "/start room_"+offline.InviteCode, loc)
	if sent := f.calls("sendMessage"); len(sent) == 0 || !strings.Contains(sent[0].body, "Сначала создайте своего бота") {
		t.Fatalf("expected the create-your-bot-first message, got %+v", sent)
	}
	master.mu.RLock()
	pending := master.pendingRooms[newcomer]
	master.mu.RUnlock()
	if pending.code != offline.InviteCode {
		t.Fatalf("invite code must be remembered like pendingRefs, got %+v", pending)
	}

	// /cancel abandons the pending invite.
	master.handleCancel(newcomer, newcomer, loc)
	if code := master.takePendingRoom(newcomer); code != "" {
		t.Fatalf("/cancel must clear the pending invite, got %q", code)
	}

	// Complete onboarding with a fresh pending invite: the join happens after the specialist exists.
	master.rememberPendingRoom(newcomer, offline.InviteCode)
	session := &OnboardingSession{State: StateAwaitingName, BotToken: "123:newcomer-token", BotUsername: "newcomerbot"}
	master.setSession(newcomer, session)
	master.handleNameInput(newcomer, newcomer, "Newbie Trainer", session, "newbie", loc)

	specialist, err := db.GetSpecialistByTelegramID(newcomer)
	if err != nil || specialist == nil {
		t.Fatalf("specialist not created: %v", err)
	}
	view, _ := db.GetRoomForSpecialist(specialist.ID)
	if view == nil || view.Room.ID != f.roomID {
		t.Fatal("onboarding must finish with joining the room")
	}
	if len(joined) != 1 || joined[0] != specialist.ID {
		t.Fatalf("join hook expected once for the new specialist, got %v", joined)
	}
	if master.takePendingRoom(newcomer) != "" {
		t.Fatal("pending invite must be consumed")
	}
}

func TestPendingRoomExpires(t *testing.T) {
	master := newMasterForRooms()
	master.pendingRooms[1] = pendingRef{code: "old", at: time.Now().Add(-2 * pendingRefTTL)}
	if code := master.takePendingRoom(1); code != "" {
		t.Fatalf("expired invite must be dropped, got %q", code)
	}
}

func TestRoomRequestCallbackIgnoresRequestsAddressedToSomeoneElse(t *testing.T) {
	f := newRoomBotFixture(t)
	day := futureDay(50)
	// B owns the day, A asks for it; A then tries to "give" it to themself through A's own bot.
	if err := db.SetWorkDates(f.b.ID, []db.WorkDateInput{{Date: mustDate(t, day)}}, nil); err != nil {
		t.Fatal(err)
	}
	request, _, err := db.CreateDayRequest(f.a.ID, mustDate(t, day))
	if err != nil {
		t.Fatal(err)
	}
	h := &Handler{Bot: &Bot{Token: "room-bot-token-a"}}
	h.handleCallbackQuery(Update{CallbackQuery: &CallbackQuery{
		ID: "cb", From: User{ID: f.a.TelegramUserID}, Data: "rdr_ok:" + request.ID,
		Message: &Message{MessageID: 1, Chat: Chat{ID: f.a.TelegramUserID}},
	}})
	if got, _ := db.GetRoomDayRequest(request.ID); got.Status != models.RoomRequestPending {
		t.Fatalf("the requester must not be able to resolve their own request, got %s", got.Status)
	}
	if len(f.calls("editMessageText")) != 0 {
		t.Fatal("no message edit expected for an unauthorized press")
	}
}

/***************************************************************************************************
* Room names are inserted as-is in quotes (no extra "кабинет" word); an unnamed room falls back to
* the plain word so sentences still read well.
***************************************************************************************************/
func TestRoomTextsWithAndWithoutName(t *testing.T) {
	setupMasterSupportTestDB(t)
	ru, en := myI18n.NewLocalizer("ru"), myI18n.NewLocalizer("en")
	date := "Чт, 20 ноя"

	tests := []struct {
		key, name string
		loc       *localizerType
		want      string
	}{
		{"Room.RequestText", "Кабинет на Ленина", ru, "🔁 Анна просит у вас Чт, 20 ноя («Кабинет на Ленина»)"},
		{"Room.RequestText", "", ru, "🔁 Анна просит у вас Чт, 20 ноя"},
		{"Room.MemberJoined", "Кабинет на Ленина", ru, "👋 Анна теперь в «Кабинет на Ленина»"},
		{"Room.MemberJoined", "", ru, "👋 Анна теперь в кабинете"},
		{"Room.MemberRemoved", "Кабинет на Ленина", ru, "Вас исключили из «Кабинет на Ленина». Ваши рабочие дни сохранены."},
		{"Room.MemberRemoved", "", ru, "Вас исключили из кабинета. Ваши рабочие дни сохранены."},
		{"MasterRoom.Invite", "Кабинет на Ленина", ru, "Анна приглашает вас в «Кабинет на Ленина»."},
		{"MasterRoom.Invite", "", ru, "Анна приглашает вас в кабинет."},
		{"MasterRoom.NeedBotFirst", "", ru, "присоединитесь к кабинету."},
		{"MasterRoom.Joined", "Кабинет на Ленина", ru, "✅ Вы теперь в «Кабинет на Ленина». Дней"},
		{"MasterRoom.Joined", "", ru, "✅ Вы теперь в кабинете. Дней"},
		{"Room.MemberJoined", "Lenina", en, "👋 Анна is now in \"Lenina\""},
		{"Room.MemberJoined", "", en, "👋 Анна is now in the room"},
		{"MasterRoom.Invite", "", en, "Анна invites you to their room."},
	}
	for _, tt := range tests {
		got := myI18n.Tf(tt.loc, tt.key, map[string]interface{}{"Name": "Анна", "Inviter": "Анна", "Date": date, "Room": tt.name, "Count": "2"})
		if !strings.Contains(got, tt.want) {
			t.Errorf("%s (room %q): %q does not contain %q", tt.key, tt.name, got, tt.want)
		}
		if strings.Contains(got, "кабинет «") || strings.Contains(got, "room \"") {
			t.Errorf("%s: the room word must not precede the quoted name: %q", tt.key, got)
		}
	}
}

func TestRoomDateFormatting(t *testing.T) {
	setupMasterSupportTestDB(t)
	thursday := time.Date(2030, 11, 21, 0, 0, 0, 0, time.UTC)
	ru, en := myI18n.NewLocalizer("ru"), myI18n.NewLocalizer("en")

	if got := formatRoomDate(ru, thursday); got != "чт, 21 ноября" {
		t.Errorf("ru date = %q", got)
	}
	if got := formatRoomDate(en, thursday); got != "Thu, Nov 21" {
		t.Errorf("en date = %q", got)
	}
	if got := formatRoomDates(ru, []string{"2030-11-21", "2030-12-02"}); got != "чт, 21 ноября; пн, 2 декабря" {
		t.Errorf("ru dates = %q", got)
	}
	// The shared booking formatter is untouched.
	if got := formatDateTime(ru, thursday); !strings.HasPrefix(got, "Чт, 21 ноя") {
		t.Errorf("booking date formatter changed: %q", got)
	}
}

func TestRoomMessagesKeepNamesNominative(t *testing.T) {
	f := newRoomBotFixture(t)
	h := &Handler{Bot: &Bot{Token: "room-bot-token-a"}}
	date := time.Date(2030, 11, 21, 0, 0, 0, 0, time.UTC)

	f.transport.calls = nil
	if err := h.NotifyRoomDaysClaimed(f.a, "Boris", []string{"2030-11-21", "2030-11-22"}); err != nil {
		t.Fatal(err)
	}
	if err := h.NotifyRoomDayRequestResult(f.a, "Boris", date, true); err != nil {
		t.Fatal(err)
	}
	if err := h.NotifyRoomDayRequestResult(f.a, "Boris", date, false); err != nil {
		t.Fatal(err)
	}
	sent := f.calls("sendMessage")
	if len(sent) != 3 {
		t.Fatalf("expected 3 messages, got %d", len(sent))
	}
	want := []string{
		"📅 Boris берёт чт, 21 ноября; пт, 22 ноября",
		"✅ Boris отдаёт вам чт, 21 ноября",
		"❌ Boris не может отдать чт, 21 ноября",
	}
	for i, w := range want {
		if !strings.Contains(sent[i].body, w) {
			t.Errorf("message %d should contain %q, got %s", i, w, sent[i].body)
		}
	}
}
