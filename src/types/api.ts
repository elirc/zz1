export type WorkspaceResponse = {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  currentMembership: {
    membershipId: string;
    role: string;
  };
  users: Array<{
    membershipId: string;
    role: string;
    status: string;
    user: {
      firstName: string;
      lastName: string;
    };
  }>;
};

export type DashboardResponse = {
  overdueFollowUps: number;
  organizationCounts: {
    leads: number;
    contacts: number;
    deals: number;
    exports: number;
  };
};

export type LeadRow = {
  id: string;
  name: string;
  status: string;
  owner?: { user?: { firstName: string; lastName: string } | null } | null;
  stage?: { id: string; name: string } | null;
};

export type ContactRow = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  owner?: { user?: { firstName: string; lastName: string } | null } | null;
};

export type DealRow = {
  id: string;
  title: string;
  value: string | number;
  stage?: { id: string; name: string } | null;
  owner?: { user?: { firstName: string; lastName: string } | null } | null;
};

export type ActivityRow = {
  id: string;
  subject: string;
  type: string;
  dueAt?: string | null;
  owner?: { user?: { firstName: string; lastName: string } | null } | null;
};

export type PipelineResponse = Array<{
  id: string;
  name: string;
  stages: Array<{
    id: string;
    name: string;
  }>;
}>;

export type PaginatedRows<T> = {
  rows: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};
