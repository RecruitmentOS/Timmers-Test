import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../../.env") });

import { db } from "../index.js";
import { sql, eq } from "drizzle-orm";
import {
  user,
  organization,
  member,
  account,
} from "../schema/auth.js";
import { pipelineStages } from "../schema/pipeline-stages.js";
import { clients } from "../schema/clients.js";
import { vacancies } from "../schema/vacancies.js";
import { candidates } from "../schema/candidates.js";
import { candidateApplications } from "../schema/applications.js";
import { withTenantContext } from "../../lib/with-tenant-context.js";

async function seed() {
  console.log("Seeding database...");

  // Use a valid UUID for the organization (RLS tables require uuid organization_id)
  const orgId = "10000000-0000-0000-0000-000000000001";

  // 1. Clean up any existing seed data with non-UUID org IDs, then create fresh
  const existingOrg = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, "demo-agency"));

  if (existingOrg.length > 0 && existingOrg[0].id !== orgId) {
    // Remove old org with invalid ID
    await db.delete(member).where(eq(member.organizationId, existingOrg[0].id));
    await db.delete(organization).where(eq(organization.id, existingOrg[0].id));
    console.log("  Cleaned up old non-UUID organization");
  }

  if (!existingOrg.length || existingOrg[0].id !== orgId) {
    await db.insert(organization).values({
      id: orgId,
      name: "Demo Agency",
      slug: "demo-agency",
    }).onConflictDoNothing();
    console.log("  Created organization: Demo Agency");
  } else {
    console.log("  Organization already exists");
  }

  // 2. Create test admin user (find or create)
  const adminUserId = "20000000-0000-0000-0000-000000000001";
  const existingUser = await db
    .select()
    .from(user)
    .where(eq(user.email, "admin@test.com"));

  let actualAdminUserId: string;
  if (existingUser.length > 0) {
    actualAdminUserId = existingUser[0].id;
    console.log(`  Admin user already exists: ${actualAdminUserId}`);
  } else {
    await db.insert(user).values({
      id: adminUserId,
      name: "Admin User",
      email: "admin@test.com",
      emailVerified: true,
    });
    actualAdminUserId = adminUserId;

    // Create password account (bcrypt hash for "password123")
    const bcryptHash =
      "$2a$10$KIXg.gCzCqWdKLbDfZfXg.sxKPqx1ELGTZcHLp3u5fN5d4ue.hy.m";
    await db.insert(account).values({
      id: "30000000-0000-0000-0000-000000000001",
      userId: actualAdminUserId,
      accountId: actualAdminUserId,
      providerId: "credential",
      password: bcryptHash,
    });

    console.log("  Created admin user: admin@test.com / password123");
  }

  // 3. Add admin as organization member (if not already)
  const existingMember = await db
    .select()
    .from(member)
    .where(eq(member.userId, actualAdminUserId));

  if (existingMember.length === 0) {
    await db.insert(member).values({
      id: "40000000-0000-0000-0000-000000000001",
      userId: actualAdminUserId,
      organizationId: orgId,
      role: "agency_admin",
    });
    console.log("  Added admin as agency_admin member");
  }

  // 4. Create all RLS-enabled data within tenant context
  await withTenantContext(orgId, async (tx) => {
    // Check if already seeded
    const existingStages = await tx.select().from(pipelineStages);
    if (existingStages.length > 0) {
      console.log("  Pipeline stages already exist, skipping seed data...");

      // Still verify counts for output
      const existingClients = await tx.select().from(clients);
      const existingVacancies = await tx.select().from(vacancies);
      const existingCandidates = await tx.select().from(candidates);
      const existingApps = await tx.select().from(candidateApplications);
      console.log(`  Existing: ${existingStages.length} stages, ${existingClients.length} clients, ${existingVacancies.length} vacancies, ${existingCandidates.length} candidates, ${existingApps.length} applications`);
      return;
    }

    // Default pipeline stages
    const defaultStages = [
      { name: "New", slug: "new", sortOrder: 0 },
      { name: "To screen", slug: "to-screen", sortOrder: 1 },
      { name: "Contact attempted", slug: "contact-attempted", sortOrder: 2 },
      { name: "Contacted", slug: "contacted", sortOrder: 3 },
      { name: "Qualified", slug: "qualified", sortOrder: 4 },
      { name: "Sent to client", slug: "sent-to-client", sortOrder: 5 },
      { name: "Interview", slug: "interview", sortOrder: 6 },
      { name: "Hired", slug: "hired", sortOrder: 7 },
      { name: "Started", slug: "started", sortOrder: 8 },
      { name: "Rejected/On hold", slug: "rejected-on-hold", sortOrder: 9 },
    ];

    for (const stage of defaultStages) {
      await tx.insert(pipelineStages).values({
        organizationId: orgId,
        name: stage.name,
        slug: stage.slug,
        sortOrder: stage.sortOrder,
        isDefault: true,
      });
    }

    console.log("  Created 10 default pipeline stages");

    // 5. Create sample clients
    const [client1] = await tx
      .insert(clients)
      .values({
        organizationId: orgId,
        name: "LogiCorp BV",
        contactPerson: "Jan de Vries",
        contactEmail: "jan@logicorp.nl",
        status: "active",
      })
      .returning();

    const [client2] = await tx
      .insert(clients)
      .values({
        organizationId: orgId,
        name: "WarehousePro",
        contactPerson: "Sandra Bakker",
        contactEmail: "sandra@warehousepro.nl",
        status: "active",
      })
      .returning();

    console.log("  Created 2 sample clients");

    // 6. Create sample vacancies
    const [vac1] = await tx
      .insert(vacancies)
      .values({
        organizationId: orgId,
        title: "Warehouse Picker - Day Shift",
        description:
          "Looking for experienced warehouse pickers for our Venlo distribution center. Day shift (07:00-15:30). Physical work, picking accuracy important.",
        location: "Venlo",
        employmentType: "temporary",
        status: "active",
        ownerId: actualAdminUserId,
        clientId: client1.id,
      })
      .returning();

    const [vac2] = await tx
      .insert(vacancies)
      .values({
        organizationId: orgId,
        title: "Delivery Driver Cat B",
        description:
          "Seeking delivery drivers for last-mile parcel delivery in Amsterdam region. Valid Cat B license required. Company van provided.",
        location: "Amsterdam",
        employmentType: "full-time",
        status: "active",
        ownerId: actualAdminUserId,
        clientId: client1.id,
      })
      .returning();

    const [vac3] = await tx
      .insert(vacancies)
      .values({
        organizationId: orgId,
        title: "Production Line Operator",
        description:
          "Machine operators needed for food production facility. Rotating shifts. HACCP knowledge is a plus.",
        location: "Rotterdam",
        employmentType: "contract",
        status: "draft",
        ownerId: actualAdminUserId,
        clientId: client2.id,
      })
      .returning();

    console.log("  Created 3 sample vacancies");

    // 7. Create sample candidates
    const [cand1] = await tx
      .insert(candidates)
      .values({
        organizationId: orgId,
        firstName: "Pieter",
        lastName: "Jansen",
        phone: "+31612345678",
        email: "pieter.jansen@email.com",
        city: "Venlo",
        source: "indeed",
      })
      .returning();

    const [cand2] = await tx
      .insert(candidates)
      .values({
        organizationId: orgId,
        firstName: "Maria",
        lastName: "Gonzalez",
        phone: "+31687654321",
        email: "maria.g@email.com",
        city: "Amsterdam",
        source: "referral",
      })
      .returning();

    const [cand3] = await tx
      .insert(candidates)
      .values({
        organizationId: orgId,
        firstName: "Ahmed",
        lastName: "El-Moutawakkil",
        phone: "+31699887766",
        email: "ahmed.em@email.com",
        city: "Rotterdam",
        source: "website",
      })
      .returning();

    const [cand4] = await tx
      .insert(candidates)
      .values({
        organizationId: orgId,
        firstName: "Eva",
        lastName: "de Boer",
        phone: "+31611223344",
        email: "eva.deboer@email.com",
        city: "Utrecht",
        source: "indeed",
      })
      .returning();

    const [cand5] = await tx
      .insert(candidates)
      .values({
        organizationId: orgId,
        firstName: "Tomasz",
        lastName: "Kowalski",
        phone: "+31655667788",
        email: "tomasz.k@email.com",
        city: "Eindhoven",
        source: "facebook",
      })
      .returning();

    console.log("  Created 5 sample candidates");

    // 8. Get the "New" stage for initial applications
    const stages = await tx.select().from(pipelineStages);
    const newStage = stages.find((s) => s.slug === "new");

    // 9. Create sample candidate applications
    await tx.insert(candidateApplications).values({
      organizationId: orgId,
      candidateId: cand1.id,
      vacancyId: vac1.id,
      ownerId: actualAdminUserId,
      qualificationStatus: "pending",
      sentToClient: false,
      currentStageId: newStage?.id ?? null,
      sourceDetail: "Applied via Indeed",
    });

    await tx.insert(candidateApplications).values({
      organizationId: orgId,
      candidateId: cand2.id,
      vacancyId: vac2.id,
      ownerId: actualAdminUserId,
      qualificationStatus: "pending",
      sentToClient: false,
      currentStageId: newStage?.id ?? null,
      sourceDetail: "Referred by existing driver",
    });

    await tx.insert(candidateApplications).values({
      organizationId: orgId,
      candidateId: cand3.id,
      vacancyId: vac1.id,
      ownerId: actualAdminUserId,
      qualificationStatus: "pending",
      sentToClient: false,
      currentStageId: newStage?.id ?? null,
      sourceDetail: "Applied via website",
    });

    console.log("  Created 3 sample candidate applications");
  });

  console.log("\nSeed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
