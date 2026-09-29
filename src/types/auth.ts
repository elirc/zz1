import { MembershipRole, MembershipStatus, PlatformRole, UserStatus } from "@prisma/client";

export type SessionMembership = {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  organizationStatus: string;
  role: MembershipRole;
  status: MembershipStatus;
};

export type AuthenticatedSession = {
  userId: string;
  email: string;
  fullName: string;
  platformRole: PlatformRole;
  userStatus: UserStatus;
  membership: SessionMembership | null;
};

export type SessionTokenPayload = {
  userId: string;
  activeMembershipId?: string;
  activeOrganizationId?: string;
};
