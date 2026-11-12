package changes

import "testing"

func TestPublishManyBumpsRoomGroupForEveryMember(t *testing.T) {
	PublishMany([]string{"spec-room-a", "spec-room-b"}, GroupRoom, GroupWorkingHours)
	PublishMany(nil, GroupRoom)

	for _, id := range []string{"spec-room-a", "spec-room-b"} {
		snapshot := Snapshot(id)
		if snapshot["room"] != 1 || snapshot["workingHours"] != 1 {
			t.Fatalf("%s: expected room and workingHours bumped once, got %v", id, snapshot)
		}
	}
	if Snapshot("spec-room-other")["room"] != 0 {
		t.Fatal("other specialists must be unaffected")
	}
}
