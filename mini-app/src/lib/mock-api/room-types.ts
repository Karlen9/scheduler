import type { TRoomMember, TWorkingInterval } from '../types';

export type TMockScenario = 'default' | 'room';

export type TMockRoomRequest = {
  id: string;
  date: string;
  /** Incoming: the colleague who asks. Outgoing: the colleague I ask. */
  memberId: string;
};

/** Mock state of the shared room ("Кабинет") of the specialist the admin screens act as. */
export type TMockRoom = {
  id: string;
  name: string;
  isCreator: boolean;
  meMemberId: string;
  members: TRoomMember[];
  /** date (YYYY-MM-DD) -> owning member id. A date without an entry is free. */
  owners: Map<string, string>;
  /** Dates on which the linked colleague has bookings (only the boolean is ever exposed). */
  colleagueBookingDates: Set<string>;
  /** Invite codes of offline members that were invited by link (member id -> code). */
  invites: Map<string, string>;
  incoming: TMockRoomRequest[];
  outgoing: TMockRoomRequest[];
};

/** Own hours of an open date; null means "default hours". */
export type TMockWorkDates = Map<string, TWorkingInterval[] | null>;
