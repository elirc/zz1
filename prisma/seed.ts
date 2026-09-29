/**
 * Seeds demo organizations, users, memberships, and operational CRM records.
 * Called by `npm run db:seed` after `npm run db:push`.
 * Calls Prisma plus pipeline bootstrap so the UI and docs have consistent demo data.
 * A junior engineer often seeds users without realistic org memberships and then demos auth on impossible data.
 */
import {
  ActivityType,
  ContactStatus,
  LeadPriority,
  LeadSource,
  LeadStatus,
  MembershipRole,
  MembershipStatus,
  OrganizationPlan,
  OrganizationStatus,
  PlatformRole,
  PrismaClient
} from "@prisma/client";
import { pipelineService } from "../src/services/pipelineService";

const prisma = new PrismaClient();

async function upsertUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  platformRole?: PlatformRole;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      platformRole: input.platformRole ?? PlatformRole.NONE
    },
    create: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      platformRole: input.platformRole ?? PlatformRole.NONE
    }
  });
}

async function upsertMembership(organizationId: string, userId: string, role: MembershipRole, title?: string) {
  return prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId,
        userId
      }
    },
    update: {
      role,
      title,
      status: MembershipStatus.ACTIVE
    },
    create: {
      organizationId,
      userId,
      role,
      title,
      status: MembershipStatus.ACTIVE
    }
  });
}

async function seed() {
  const northwind = await prisma.organization.upsert({
    where: { slug: "northwind-revenue" },
    update: {
      name: "Northwind Revenue",
      plan: OrganizationPlan.GROWTH,
      status: OrganizationStatus.ACTIVE
    },
    create: {
      name: "Northwind Revenue",
      slug: "northwind-revenue",
      plan: OrganizationPlan.GROWTH,
      status: OrganizationStatus.ACTIVE,
      settings: {
        locale: "en-US",
        timezone: "America/Los_Angeles",
        defaultCurrency: "USD"
      }
    }
  });

  const apex = await prisma.organization.upsert({
    where: { slug: "apex-industrial" },
    update: {
      name: "Apex Industrial",
      plan: OrganizationPlan.ENTERPRISE,
      status: OrganizationStatus.TRIALING
    },
    create: {
      name: "Apex Industrial",
      slug: "apex-industrial",
      plan: OrganizationPlan.ENTERPRISE,
      status: OrganizationStatus.TRIALING
    }
  });

  const platformAdmin = await upsertUser({
    email: "platform@atlascrm.dev",
    firstName: "Parker",
    lastName: "Platform",
    platformRole: PlatformRole.PLATFORM_ADMIN
  });
  const orgAdmin = await upsertUser({
    email: "admin@northwindcrm.dev",
    firstName: "Avery",
    lastName: "Admin"
  });
  const manager = await upsertUser({
    email: "manager@northwindcrm.dev",
    firstName: "Mina",
    lastName: "Manager"
  });
  const rep = await upsertUser({
    email: "rep@northwindcrm.dev",
    firstName: "Reese",
    lastName: "Rep"
  });
  const readOnly = await upsertUser({
    email: "readonly@northwindcrm.dev",
    firstName: "Riley",
    lastName: "Reader"
  });
  const apexAdmin = await upsertUser({
    email: "admin@apexcrm.dev",
    firstName: "Alex",
    lastName: "Apex"
  });

  const northwindAdminMembership = await upsertMembership(
    northwind.id,
    orgAdmin.id,
    MembershipRole.ORGANIZATION_ADMIN,
    "Revenue Operations Lead"
  );
  const northwindManagerMembership = await upsertMembership(
    northwind.id,
    manager.id,
    MembershipRole.SALES_MANAGER,
    "Regional Sales Manager"
  );
  const northwindRepMembership = await upsertMembership(
    northwind.id,
    rep.id,
    MembershipRole.SALES_REP,
    "Account Executive"
  );
  await upsertMembership(northwind.id, readOnly.id, MembershipRole.READ_ONLY, "Finance Observer");
  await upsertMembership(northwind.id, platformAdmin.id, MembershipRole.ORGANIZATION_ADMIN, "Platform Liaison");
  await upsertMembership(apex.id, apexAdmin.id, MembershipRole.ORGANIZATION_ADMIN, "Pilot Admin");

  await pipelineService.provisionDefaultPipeline(prisma, northwind.id);
  await pipelineService.provisionDefaultPipeline(prisma, apex.id);

  const northwindPipeline = await prisma.pipeline.findFirstOrThrow({
    where: { organizationId: northwind.id, isDefault: true },
    include: {
      stages: {
        orderBy: { position: "asc" }
      }
    }
  });

  const [inboxStage, workingStage, qualifiedStage, proposalStage] = northwindPipeline.stages;

  const northwindLeadCount = await prisma.lead.count({
    where: { organizationId: northwind.id }
  });

  if (northwindLeadCount === 0) {
    const leadA = await prisma.lead.create({
      data: {
        organizationId: northwind.id,
        pipelineId: northwindPipeline.id,
        stageId: inboxStage.id,
        ownerMembershipId: northwindRepMembership.id,
        createdByMembershipId: northwindAdminMembership.id,
        updatedByMembershipId: northwindAdminMembership.id,
        name: "Jordan Diaz",
        email: "jordan.diaz@acmebuyer.dev",
        companyName: "Acme Buyer Group",
        source: LeadSource.WEBSITE,
        status: LeadStatus.NEW,
        priority: LeadPriority.HIGH,
        tags: ["enterprise", "inbound"]
      }
    });

    const leadB = await prisma.lead.create({
      data: {
        organizationId: northwind.id,
        pipelineId: northwindPipeline.id,
        stageId: workingStage.id,
        ownerMembershipId: northwindManagerMembership.id,
        createdByMembershipId: northwindAdminMembership.id,
        updatedByMembershipId: northwindManagerMembership.id,
        name: "Taylor Singh",
        email: "taylor.singh@riversteel.dev",
        companyName: "River Steel",
        source: LeadSource.OUTBOUND,
        status: LeadStatus.WORKING,
        priority: LeadPriority.MEDIUM,
        tags: ["outbound"]
      }
    });

    await prisma.lead.create({
      data: {
        organizationId: northwind.id,
        pipelineId: northwindPipeline.id,
        stageId: qualifiedStage.id,
        ownerMembershipId: northwindRepMembership.id,
        createdByMembershipId: northwindAdminMembership.id,
        updatedByMembershipId: northwindRepMembership.id,
        name: "Morgan Patel",
        email: "morgan.patel@sunline.dev",
        companyName: "Sunline Retail",
        source: LeadSource.REFERRAL,
        status: LeadStatus.QUALIFIED,
        priority: LeadPriority.URGENT,
        tags: ["referral", "priority"]
      }
    });

    const contact = await prisma.contact.create({
      data: {
        organizationId: northwind.id,
        firstName: "Casey",
        lastName: "Nguyen",
        email: "casey.nguyen@marketcore.dev",
        status: ContactStatus.ACTIVE,
        ownerMembershipId: northwindManagerMembership.id,
        createdByMembershipId: northwindAdminMembership.id,
        sourceLeadId: leadB.id
      }
    });

    const deal = await prisma.deal.create({
      data: {
        organizationId: northwind.id,
        pipelineId: northwindPipeline.id,
        stageId: proposalStage.id,
        ownerMembershipId: northwindManagerMembership.id,
        createdByMembershipId: northwindAdminMembership.id,
        primaryContactId: contact.id,
        sourceLeadId: leadA.id,
        title: "MarketCore annual expansion",
        value: 48000,
        currency: "USD",
        nextStep: "Pricing review with procurement"
      }
    });

    await prisma.activity.createMany({
      data: [
        {
          organizationId: northwind.id,
          leadId: leadA.id,
          ownerMembershipId: northwindRepMembership.id,
          createdByMembershipId: northwindRepMembership.id,
          type: ActivityType.TASK,
          subject: "Follow up on demo request",
          dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
        },
        {
          organizationId: northwind.id,
          dealId: deal.id,
          ownerMembershipId: northwindManagerMembership.id,
          createdByMembershipId: northwindManagerMembership.id,
          type: ActivityType.MEETING,
          subject: "Commercial review",
          dueAt: new Date(Date.now() + 1000 * 60 * 60 * 48)
        }
      ]
    });

    await prisma.savedView.create({
      data: {
        organizationId: northwind.id,
        ownerMembershipId: northwindManagerMembership.id,
        resource: "LEAD",
        visibility: "ORGANIZATION",
        name: "Qualified this week",
        filters: {
          status: "QUALIFIED"
        }
      }
    });
  }

  const invitationCount = await prisma.invitation.count({
    where: { organizationId: northwind.id }
  });

  if (invitationCount === 0) {
    await prisma.invitation.create({
      data: {
        organizationId: northwind.id,
        email: "newhire@northwindcrm.dev",
        role: MembershipRole.SALES_REP,
        invitedByUserId: orgAdmin.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
      }
    });
  }

  console.log("Seed complete.");
  console.log("Platform admin:", platformAdmin.email);
  console.log("Org admin:", orgAdmin.email);
  console.log("Sales manager:", manager.email);
  console.log("Sales rep:", rep.email);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
