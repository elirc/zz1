/**
 * Hydrates demo login requests into session cookie payloads.
 * Called by auth route handlers and intentionally kept separate from UI code.
 * Calls Prisma user lookups and session cookie helpers.
 * A junior engineer often lets the client choose any role or tenant directly instead of resolving real memberships server-side.
 */
import { MembershipStatus, OrganizationStatus, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { notFoundError, unauthorizedError } from "@/lib/http/errors";
import { setSessionCookie } from "@/lib/auth/session";
import { userRepository } from "@/repositories/userRepository";

export const authService = {
  async demoLogin(input: { email: string; organizationId?: string }) {
    const user = await prisma.user.findUnique({
      where: {
        email: input.email.toLowerCase()
      },
      include: {
        memberships: {
          where: {
            status: MembershipStatus.ACTIVE,
            organization: {
              status: { in: [OrganizationStatus.ACTIVE, OrganizationStatus.TRIALING] }
            }
          },
          include: {
            organization: true
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw unauthorizedError("login_failed", "No active user was found for that email.");
    }

    const membership = input.organizationId
      ? user.memberships.find((entry) => entry.organizationId === input.organizationId)
      : user.memberships[0];

    if (input.organizationId && !membership) {
      throw notFoundError("membership_not_found", "That user does not have access to the requested organization.");
    }

    await setSessionCookie({
      userId: user.id,
      activeMembershipId: membership?.id,
      activeOrganizationId: membership?.organizationId
    });

    await userRepository.updateLastLogin(prisma, user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: `${user.firstName} ${user.lastName}`,
        platformRole: user.platformRole
      },
      membership: membership
        ? {
            membershipId: membership.id,
            organizationId: membership.organizationId,
            organizationName: membership.organization.name,
            role: membership.role
          }
        : null
    };
  }
};
