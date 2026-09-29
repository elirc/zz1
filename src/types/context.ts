import { AuthenticatedSession } from "@/types/auth";

export type RequestContext = {
  requestId: string;
  session: AuthenticatedSession;
  tenantId: string | null;
};

export type OrgRequestContext = RequestContext & {
  membership: NonNullable<AuthenticatedSession["membership"]>;
  tenantId: string;
};
