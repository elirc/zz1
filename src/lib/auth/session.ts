/**
 * Owns session token signing, cookie parsing, and hydrated session loading.
 * Called by src/lib/middleware/withAuth.ts and auth route handlers.
 * Calls jose for token verification and Prisma to hydrate the active user and membership.
 * A junior engineer often trusts session payloads directly instead of reloading current membership status from the database.
 */
import { MembershipStatus, PlatformRole, UserStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db/prisma";
import { getRequiredEnv } from "@/lib/env";
import { unauthorizedError } from "@/lib/http/errors";
import { AuthenticatedSession, SessionTokenPayload } from "@/types/auth";

export const SESSION_COOKIE_NAME = "atlas_session";

function getSessionSecret() {
  return new TextEncoder().encode(getRequiredEnv("CRM_SESSION_SECRET"));
}

export async function signSessionToken(payload: SessionTokenPayload) {
  return new SignJWT({
    activeMembershipId: payload.activeMembershipId,
    activeOrganizationId: payload.activeOrganizationId
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());
}

export async function setSessionCookie(payload: SessionTokenPayload) {
  const token = await signSessionToken(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getOptionalSession(request: NextRequest): Promise<AuthenticatedSession | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  let payload: { sub?: string; activeMembershipId?: string };

  try {
    const verified = await jwtVerify(token, getSessionSecret());
    payload = {
      sub: verified.payload.sub,
      activeMembershipId: verified.payload.activeMembershipId as string | undefined
    };
  } catch {
    throw unauthorizedError("invalid_session", "Your session is invalid or has expired.");
  }

  if (!payload.sub) {
    throw unauthorizedError("invalid_session", "Your session is missing a user identity.");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      memberships: payload.activeMembershipId
        ? {
            where: { id: payload.activeMembershipId },
            include: { organization: true }
          }
        : {
            where: {
              status: MembershipStatus.ACTIVE,
              organization: { status: { in: ["ACTIVE", "TRIALING"] } }
            },
            include: { organization: true },
            take: 1
      }
    }
  });

  // ⚠️ SENIOR NOTE: Never treat the JWT as the source of truth for org role or membership status; reload it or revocations will be ignored.
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw unauthorizedError("user_inactive", "This user is not active.");
  }

  const membership = user.memberships[0];

  return {
    userId: user.id,
    email: user.email,
    fullName: `${user.firstName} ${user.lastName}`,
    platformRole: user.platformRole ?? PlatformRole.NONE,
    userStatus: user.status,
    membership: membership
      ? {
          membershipId: membership.id,
          organizationId: membership.organizationId,
          organizationName: membership.organization.name,
          organizationStatus: membership.organization.status,
          role: membership.role,
          status: membership.status
        }
      : null
  };
}
