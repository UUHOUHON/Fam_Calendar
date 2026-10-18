export type MemberDTO = {
  id: string;
  name: string;
  email: string;
  color: string;
  timezone: string;
  familyId: string;
  role: string;
  status: string;
};

export type ActivityInviteDTO = {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  status: string;
  token: string;
};

export type ActivityDTO = {
  id: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  memberId: string;
  member: MemberDTO;
  invites: ActivityInviteDTO[];
  pendingForViewer?: boolean;
};

export type FamilyBundle = {
  family: {
    id: string;
    name: string;
  };
  members: MemberDTO[];
  activities: ActivityDTO[];
  me: MemberDTO | null;
};

export type DayAlignment = {
  viewerDate: string;
  members: Array<{
    memberId: string;
    memberName: string;
    color: string;
    timezone: string;
    localDate: string;
    localWeekday: string;
    offsetLabel: string;
    isSameCalendarDay: boolean;
  }>;
};

export type OverlapWindow = {
  startAt: string;
  endAt: string;
  memberIds: string[];
  activityIds: string[];
};

export type FamilyInviteDTO = {
  id: string;
  email: string;
  status: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  invitedByName: string;
};

export type EmailLogDTO = {
  id: string;
  to: string;
  subject: string;
  previewUrl: string | null;
  status: string;
  createdAt: string;
};
