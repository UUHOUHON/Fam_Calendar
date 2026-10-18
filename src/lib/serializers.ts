import type {
  Activity,
  ActivityInvite,
  Family,
  Member,
} from "@prisma/client";
import type { ActivityDTO, MemberDTO } from "./types";

type InviteWithMember = ActivityInvite & { member: Member };
type ActivityWithRelations = Activity & {
  member: Member;
  invites: InviteWithMember[];
};

export function serializeMember(member: Member): MemberDTO {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    color: member.color,
    timezone: member.timezone,
    familyId: member.familyId,
    role: member.role,
    status: member.status,
  };
}

export function serializeActivity(
  activity: ActivityWithRelations,
  viewerId?: string | null,
): ActivityDTO {
  return {
    id: activity.id,
    title: activity.title,
    description: activity.description,
    startAt: activity.startAt.toISOString(),
    endAt: activity.endAt.toISOString(),
    allDay: activity.allDay,
    memberId: activity.memberId,
    member: serializeMember(activity.member),
    invites: activity.invites.map((invite) => ({
      id: invite.id,
      memberId: invite.memberId,
      memberName: invite.member.name,
      memberEmail: invite.member.email,
      status: invite.status,
      token: invite.token,
    })),
    pendingForViewer: viewerId
      ? activity.invites.some(
          (i) => i.memberId === viewerId && i.status === "PENDING",
        )
      : false,
  };
}

export function isActivityVisibleToViewer(
  activity: ActivityWithRelations,
  viewerId: string,
): boolean {
  if (activity.memberId === viewerId) return true;
  if (activity.invites.length === 0) return true;

  const myInvite = activity.invites.find((i) => i.memberId === viewerId);
  if (myInvite) return myInvite.status === "ACCEPTED";

  // Other family members only see confirmed shared plans
  return activity.invites.some((i) => i.status === "ACCEPTED");
}

export function serializeFamilyBundle(
  family: Family,
  members: Member[],
  activities: ActivityWithRelations[],
  me: Member | null,
) {
  const visible = me
    ? activities.filter((a) => isActivityVisibleToViewer(a, me.id))
    : [];

  return {
    family: { id: family.id, name: family.name },
    members: members
      .filter((m) => m.status === "ACTIVE")
      .map(serializeMember),
    activities: visible.map((a) => serializeActivity(a, me?.id)),
    me: me ? serializeMember(me) : null,
  };
}
