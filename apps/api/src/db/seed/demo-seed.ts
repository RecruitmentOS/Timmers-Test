import { db } from "../index.js";
import { eq } from "drizzle-orm";
import {
  user,
  organization,
  member,
  account,
} from "../schema/auth.js";
import { hashPassword } from "better-auth/crypto";
import { pipelineStages } from "../schema/pipeline-stages.js";
import { clients } from "../schema/clients.js";
import { vacancies } from "../schema/vacancies.js";
import { candidates } from "../schema/candidates.js";
import { candidateApplications } from "../schema/applications.js";
import { tasks } from "../schema/tasks.js";
import { qualificationPresets } from "../schema/qualification-presets.js";
import { driverQualifications } from "../schema/driver-qualifications.js";
import { placements } from "../schema/applications.js";
import { withTenantContext } from "../../lib/with-tenant-context.js";

// Fixed UUIDs for demo orgs
const EMPLOYER_ORG_ID = "d0000000-0000-0000-0000-000000000001";
const AGENCY_ORG_ID = "d0000000-0000-0000-0000-000000000002";
const DEMO_USER_ID = "d0000000-0000-0000-0000-000000000099";

/**
 * Seeds two demo organizations with realistic transport data.
 *
 * 1. "Demo Transport BV" (employer mode) — 3 vacancies, 8 candidates, 12 applications, 5 tasks
 * 2. "Demo Recruitment Agency" (agency mode) — 2 clients, 4 vacancies, 10 candidates, 15 applications, 6 tasks
 *
 * Demo user: demo@recruitment-os.nl / demo2026
 */
export async function seedDemoEnvironment(): Promise<void> {
  console.log("Seeding demo environment...\n");

  // ── 1. Create demo user ──────────────────────────────────────────────
  const existingUser = await db
    .select()
    .from(user)
    .where(eq(user.email, "demo@recruitment-os.nl"));

  let demoUserId = DEMO_USER_ID;
  if (existingUser.length > 0) {
    demoUserId = existingUser[0].id;
    console.log(`  Demo user already exists: ${demoUserId}`);
  } else {
    await db.insert(user).values({
      id: DEMO_USER_ID,
      name: "Demo Gebruiker",
      email: "demo@recruitment-os.nl",
      emailVerified: true,
      language: "nl",
    });

    const hashedPassword = await hashPassword("demo2026");
    await db.insert(account).values({
      id: "d0000000-0000-0000-0000-0000000000a1",
      userId: DEMO_USER_ID,
      accountId: DEMO_USER_ID,
      providerId: "credential",
      password: hashedPassword,
    });

    console.log("  Created demo user: demo@recruitment-os.nl / demo2026");
  }

  // ── 2. Create Demo Transport BV (employer mode) ──────────────────────
  await seedEmployerOrg(demoUserId);

  // ── 3. Create Demo Recruitment Agency (agency mode) ──────────────────
  await seedAgencyOrg(demoUserId);

  console.log("\nDemo seed complete!");
}

// ────────────────────────────────────────────────────────────────────────────
// Employer org
// ────────────────────────────────────────────────────────────────────────────

async function seedEmployerOrg(demoUserId: string): Promise<void> {
  console.log("\n  --- Demo Transport BV (employer) ---");

  // Create org if needed
  const existing = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, "demo-employer"));

  if (existing.length === 0) {
    await db.insert(organization).values({
      id: EMPLOYER_ORG_ID,
      name: "Demo Transport BV",
      slug: "demo-employer",
      metadata: JSON.stringify({
        mode: "employer",
        primaryLocation: "Amsterdam",
        expectedUserCount: "6-20",
      }),
    });
    console.log("  Created organization: Demo Transport BV");
  } else {
    console.log("  Organization already exists");
  }

  // Assign demo user as owner
  const existingMember = await db
    .select()
    .from(member)
    .where(eq(member.userId, demoUserId));

  const isAlreadyMemberOfEmployer = existingMember.some(
    (m) => m.organizationId === EMPLOYER_ORG_ID
  );

  if (!isAlreadyMemberOfEmployer) {
    await db.insert(member).values({
      id: `d1-member-${Date.now()}`,
      userId: demoUserId,
      organizationId: EMPLOYER_ORG_ID,
      role: "owner",
    });
    console.log("  Added demo user as owner");
  }

  // Seed tenant data
  await withTenantContext(EMPLOYER_ORG_ID, async (tx) => {
    // Check if already seeded
    const existingStages = await tx.select().from(pipelineStages);
    if (existingStages.length > 0) {
      console.log("  Already seeded, skipping...");
      return;
    }

    // Pipeline stages (employer set — no "Sent to client")
    const employerStages = [
      { name: "Nieuw", slug: "new", sortOrder: 0 },
      { name: "Te screenen", slug: "to-screen", sortOrder: 1 },
      { name: "Contact poging", slug: "contact-attempted", sortOrder: 2 },
      { name: "Gecontacteerd", slug: "contacted", sortOrder: 3 },
      { name: "Gekwalificeerd", slug: "qualified", sortOrder: 4 },
      { name: "Interview", slug: "interview", sortOrder: 5 },
      { name: "Aangenomen", slug: "hired", sortOrder: 6 },
      { name: "Gestart", slug: "started", sortOrder: 7 },
      { name: "Afgewezen/On hold", slug: "rejected-on-hold", sortOrder: 8 },
    ];

    const stageRecords: Record<string, string> = {};
    for (const stage of employerStages) {
      const [inserted] = await tx
        .insert(pipelineStages)
        .values({
          organizationId: EMPLOYER_ORG_ID,
          name: stage.name,
          slug: stage.slug,
          sortOrder: stage.sortOrder,
          isDefault: true,
        })
        .returning();
      stageRecords[stage.slug] = inserted.id;
    }
    console.log(`  Created ${employerStages.length} pipeline stages`);

    // 3 vacancies
    const [vac1] = await tx
      .insert(vacancies)
      .values({
        organizationId: EMPLOYER_ORG_ID,
        title: "CE Chauffeur Internationaal",
        description:
          "Wij zoeken een ervaren CE chauffeur voor internationaal transport. Vaste routes richting Duitsland, Frankrijk en Belgie. Moderne vrachtwagen, goede secundaire arbeidsvoorwaarden.",
        location: "Amsterdam",
        employmentType: "full-time",
        status: "active",
        ownerId: demoUserId,
        requiredLicenses: JSON.stringify(["CE", "code95"]),
      })
      .returning();

    const [vac2] = await tx
      .insert(vacancies)
      .values({
        organizationId: EMPLOYER_ORG_ID,
        title: "C Chauffeur Distributie",
        description:
          "C chauffeur gezocht voor distributie in de regio Randstad. Dagdienst, thuis elke avond. Ervaring met haakarm en kipperwerk is een pre.",
        location: "Rotterdam",
        employmentType: "full-time",
        status: "active",
        ownerId: demoUserId,
        requiredLicenses: JSON.stringify(["C", "code95"]),
      })
      .returning();

    const [vac3] = await tx
      .insert(vacancies)
      .values({
        organizationId: EMPLOYER_ORG_ID,
        title: "Chauffeur Koelvervoer",
        description:
          "Chauffeur voor koelvervoer van vers producten. ADR-certificaat gewenst. Nachtwerk mogelijk. Standplaats Eindhoven.",
        location: "Eindhoven",
        employmentType: "full-time",
        status: "paused",
        ownerId: demoUserId,
        requiredLicenses: JSON.stringify(["CE", "code95", "ADR"]),
        hourlyRate: "20.00",
      })
      .returning();

    console.log("  Created 3 vacancies");

    // 8 candidates with realistic Dutch transport names + transport fields
    const today = new Date().toISOString().split("T")[0];
    const twoWeeksOut = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    const candidateData = [
      { firstName: "Jan", lastName: "de Vries", city: "Amsterdam", source: "indeed" as const, availabilityType: "direct" as const, availabilityStartDate: today, contractType: "vast" as const },
      { firstName: "Piet", lastName: "Bakker", city: "Rotterdam", source: "marktplaats" as const, availabilityType: "direct" as const, availabilityStartDate: today, contractType: "tijdelijk" as const },
      { firstName: "Kees", lastName: "Visser", city: "Utrecht", source: "website" as const, availabilityType: "opzegtermijn" as const, availabilityStartDate: twoWeeksOut, contractType: "vast" as const },
      { firstName: "Henk", lastName: "Smit", city: "Eindhoven", source: "indeed" as const, availabilityType: "direct" as const, availabilityStartDate: today, contractType: "uitzend" as const },
      { firstName: "Willem", lastName: "Meijer", city: "Den Haag", source: "referral" as const, availabilityType: "in_overleg" as const, availabilityStartDate: null, contractType: "zzp" as const },
      { firstName: "Dirk", lastName: "de Boer", city: "Breda", source: "indeed" as const, availabilityType: "direct" as const, availabilityStartDate: today, contractType: "vast" as const },
      { firstName: "Gerrit", lastName: "Mulder", city: "Tilburg", source: "facebook" as const, availabilityType: "opzegtermijn" as const, availabilityStartDate: twoWeeksOut, contractType: "tijdelijk" as const },
      { firstName: "Arjan", lastName: "de Groot", city: "Arnhem", source: "website" as const, availabilityType: "in_overleg" as const, availabilityStartDate: null, contractType: "vast" as const },
    ];

    const candidateIds: string[] = [];
    for (const c of candidateData) {
      const [inserted] = await tx
        .insert(candidates)
        .values({
          organizationId: EMPLOYER_ORG_ID,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: `+3161${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase().replace(/ /g, "")}@email.com`,
          city: c.city,
          source: c.source,
          availabilityType: c.availabilityType,
          availabilityStartDate: c.availabilityStartDate ? new Date(c.availabilityStartDate) : null,
          contractType: c.contractType,
        })
        .returning();
      candidateIds.push(inserted.id);
    }
    console.log("  Created 8 candidates");

    // Driver qualifications (varying licenses)
    const licenseData = [
      { candidateIdx: 0, type: "CE" },
      { candidateIdx: 0, type: "code95" },
      { candidateIdx: 1, type: "C" },
      { candidateIdx: 1, type: "code95" },
      { candidateIdx: 2, type: "B" },
      { candidateIdx: 3, type: "CE" },
      { candidateIdx: 3, type: "code95" },
      { candidateIdx: 3, type: "ADR" },
      { candidateIdx: 4, type: "C" },
      { candidateIdx: 5, type: "CE" },
      { candidateIdx: 5, type: "code95" },
      { candidateIdx: 6, type: "B" },
      { candidateIdx: 7, type: "C" },
      { candidateIdx: 7, type: "code95" },
    ];

    for (const lic of licenseData) {
      await tx.insert(driverQualifications).values({
        organizationId: EMPLOYER_ORG_ID,
        candidateId: candidateIds[lic.candidateIdx],
        type: lic.type,
        issuedAt: "2020-01-15",
        expiresAt: lic.type === "code95" ? "2027-01-15" : null,
      });
    }
    console.log("  Created driver qualifications");

    // 12 applications distributed across stages
    const applicationMappings = [
      { candidateIdx: 0, vacancyId: vac1.id, stage: "qualified" },
      { candidateIdx: 1, vacancyId: vac2.id, stage: "contacted" },
      { candidateIdx: 2, vacancyId: vac2.id, stage: "new" },
      { candidateIdx: 3, vacancyId: vac1.id, stage: "hired" },
      { candidateIdx: 4, vacancyId: vac2.id, stage: "to-screen" },
      { candidateIdx: 5, vacancyId: vac1.id, stage: "interview" },
      { candidateIdx: 6, vacancyId: vac2.id, stage: "new" },
      { candidateIdx: 7, vacancyId: vac1.id, stage: "qualified" },
      { candidateIdx: 0, vacancyId: vac2.id, stage: "new" },
      { candidateIdx: 1, vacancyId: vac3.id, stage: "contact-attempted" },
      { candidateIdx: 3, vacancyId: vac3.id, stage: "qualified" },
      { candidateIdx: 5, vacancyId: vac3.id, stage: "new" },
    ];

    for (const app of applicationMappings) {
      await tx.insert(candidateApplications).values({
        organizationId: EMPLOYER_ORG_ID,
        candidateId: candidateIds[app.candidateIdx],
        vacancyId: app.vacancyId,
        ownerId: demoUserId,
        currentStageId: stageRecords[app.stage],
        qualificationStatus: app.stage === "hired" ? "yes" : app.stage === "qualified" ? "yes" : "pending",
        sentToClient: false,
        sourceDetail: "Demo seed",
      });
    }
    console.log("  Created 12 applications");

    // 5 tasks (2 overdue, 1 due today, 2 future)
    const now = new Date();
    const taskData = [
      { title: "Bel Jan de Vries terug over CE vacature", candidateIdx: 0, vacancyId: vac1.id, dueOffset: -3, priority: "high" as const },
      { title: "Check rijbewijs verloopdatum Henk Smit", candidateIdx: 3, vacancyId: null, dueOffset: -1, priority: "urgent" as const },
      { title: "Interview inplannen met Dirk de Boer", candidateIdx: 5, vacancyId: vac1.id, dueOffset: 0, priority: "high" as const },
      { title: "Referentiecheck Willem Meijer", candidateIdx: 4, vacancyId: vac2.id, dueOffset: 3, priority: "medium" as const },
      { title: "Arjan de Groot documenten opvragen", candidateIdx: 7, vacancyId: vac1.id, dueOffset: 5, priority: "low" as const },
    ];

    for (const t of taskData) {
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + t.dueOffset);

      await tx.insert(tasks).values({
        organizationId: EMPLOYER_ORG_ID,
        title: t.title,
        candidateId: t.vacancyId ? null : candidateIds[t.candidateIdx],
        vacancyId: t.vacancyId ?? null,
        assignedToUserId: demoUserId,
        createdByUserId: demoUserId,
        dueDate,
        priority: t.priority,
        status: "open",
      });
    }
    console.log("  Created 5 tasks");

    // Qualification presets
    await tx.insert(qualificationPresets).values([
      {
        organizationId: EMPLOYER_ORG_ID,
        name: "CE Chauffeur Internationaal",
        criteria: JSON.stringify([
          "Rijbewijs CE geldig",
          "Code 95 geldig",
          "Minimaal 2 jaar ervaring internationaal",
          "Digitachograafkaart",
        ]),
        isDefault: true,
      },
      {
        organizationId: EMPLOYER_ORG_ID,
        name: "C Chauffeur Distributie",
        criteria: JSON.stringify([
          "Rijbewijs C geldig",
          "Code 95 geldig",
          "Ervaring met distributie",
        ]),
        isDefault: false,
      },
    ]);
    console.log("  Created 2 qualification presets");
  });

  console.log("  Employer org seed complete");
}

// ────────────────────────────────────────────────────────────────────────────
// Agency org
// ────────────────────────────────────────────────────────────────────────────

async function seedAgencyOrg(demoUserId: string): Promise<void> {
  console.log("\n  --- Demo Recruitment Agency (agency) ---");

  const existing = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, "demo-agency-demo"));

  // Avoid clash with existing demo-agency slug from original seed
  const agencySlug = "demo-agency";

  const existingWithSlug = await db
    .select()
    .from(organization)
    .where(eq(organization.id, AGENCY_ORG_ID));

  if (existingWithSlug.length === 0) {
    await db.insert(organization).values({
      id: AGENCY_ORG_ID,
      name: "Demo Recruitment Agency",
      slug: agencySlug,
      metadata: JSON.stringify({
        mode: "agency",
        primaryLocation: "Rotterdam",
        expectedUserCount: "6-20",
      }),
    });
    console.log("  Created organization: Demo Recruitment Agency");
  } else {
    console.log("  Organization already exists");
  }

  // Assign demo user as owner
  const existingMembers = await db
    .select()
    .from(member)
    .where(eq(member.userId, demoUserId));

  const isAlreadyMemberOfAgency = existingMembers.some(
    (m) => m.organizationId === AGENCY_ORG_ID
  );

  if (!isAlreadyMemberOfAgency) {
    await db.insert(member).values({
      id: `d2-member-${Date.now()}`,
      userId: demoUserId,
      organizationId: AGENCY_ORG_ID,
      role: "owner",
    });
    console.log("  Added demo user as owner");
  }

  await withTenantContext(AGENCY_ORG_ID, async (tx) => {
    const existingStages = await tx.select().from(pipelineStages);
    if (existingStages.length > 0) {
      console.log("  Already seeded, skipping...");
      return;
    }

    // Pipeline stages (agency set — includes "Verstuurd naar klant")
    const agencyStages = [
      { name: "Nieuw", slug: "new", sortOrder: 0 },
      { name: "Te screenen", slug: "to-screen", sortOrder: 1 },
      { name: "Contact poging", slug: "contact-attempted", sortOrder: 2 },
      { name: "Gecontacteerd", slug: "contacted", sortOrder: 3 },
      { name: "Gekwalificeerd", slug: "qualified", sortOrder: 4 },
      { name: "Verstuurd naar klant", slug: "sent-to-client", sortOrder: 5 },
      { name: "Interview", slug: "interview", sortOrder: 6 },
      { name: "Aangenomen", slug: "hired", sortOrder: 7 },
      { name: "Gestart", slug: "started", sortOrder: 8 },
      { name: "Afgewezen/On hold", slug: "rejected-on-hold", sortOrder: 9 },
    ];

    const stageRecords: Record<string, string> = {};
    for (const stage of agencyStages) {
      const [inserted] = await tx
        .insert(pipelineStages)
        .values({
          organizationId: AGENCY_ORG_ID,
          name: stage.name,
          slug: stage.slug,
          sortOrder: stage.sortOrder,
          isDefault: true,
        })
        .returning();
      stageRecords[stage.slug] = inserted.id;
    }
    console.log(`  Created ${agencyStages.length} pipeline stages`);

    // 2 clients
    const [client1] = await tx
      .insert(clients)
      .values({
        organizationId: AGENCY_ORG_ID,
        name: "Van den Berg Transport",
        contactPerson: "Hans van den Berg",
        contactEmail: "hans@vandenbergtransport.nl",
        status: "active",
      })
      .returning();

    const [client2] = await tx
      .insert(clients)
      .values({
        organizationId: AGENCY_ORG_ID,
        name: "De Vries Logistics",
        contactPerson: "Sandra de Vries",
        contactEmail: "sandra@devrieslogistics.nl",
        status: "active",
      })
      .returning();

    console.log("  Created 2 clients");

    // 4 vacancies (2 per client)
    const [vac1] = await tx
      .insert(vacancies)
      .values({
        organizationId: AGENCY_ORG_ID,
        title: "Chauffeur CE - Regio Noord",
        description:
          "CE chauffeur gezocht voor vaste klant Van den Berg Transport. Internationaal transport richting Scandinavie. Weekendwerk minimaal.",
        location: "Groningen",
        employmentType: "temporary",
        status: "active",
        ownerId: demoUserId,
        clientId: client1.id,
        requiredLicenses: JSON.stringify(["CE", "code95"]),
        hourlyRate: "22.50",
      })
      .returning();

    const [vac2] = await tx
      .insert(vacancies)
      .values({
        organizationId: AGENCY_ORG_ID,
        title: "C Chauffeur Bouw - Regio Midden",
        description:
          "C chauffeur voor bouwtransport bij Van den Berg. Ervaring met kipperwerk en containers. Standplaats Amersfoort.",
        location: "Amersfoort",
        employmentType: "temporary",
        status: "active",
        ownerId: demoUserId,
        clientId: client1.id,
        requiredLicenses: JSON.stringify(["C", "code95"]),
        hourlyRate: "19.50",
      })
      .returning();

    const [vac3] = await tx
      .insert(vacancies)
      .values({
        organizationId: AGENCY_ORG_ID,
        title: "CE Chauffeur ADR - Regio Zuid",
        description:
          "CE chauffeur met ADR certificaat voor De Vries Logistics. Transport van gevaarlijke stoffen. Ervaring vereist.",
        location: "Maastricht",
        employmentType: "temporary",
        status: "active",
        ownerId: demoUserId,
        clientId: client2.id,
        requiredLicenses: JSON.stringify(["CE", "code95", "ADR"]),
        hourlyRate: "25.00",
      })
      .returning();

    const [vac4] = await tx
      .insert(vacancies)
      .values({
        organizationId: AGENCY_ORG_ID,
        title: "Chauffeur Koelvervoer - Regio West",
        description:
          "Chauffeur voor koeltransport bij De Vries Logistics. Vers producten, nachtwerk. Standplaats Den Haag.",
        location: "Den Haag",
        employmentType: "temporary",
        status: "active",
        ownerId: demoUserId,
        clientId: client2.id,
        requiredLicenses: JSON.stringify(["CE", "code95"]),
        hourlyRate: "21.00",
      })
      .returning();

    console.log("  Created 4 vacancies");

    // 10 candidates (mix of NL/PL/RO per transport reality) with transport fields
    const agencyToday = new Date().toISOString().split("T")[0];
    const agencyTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    const agencyCandidateData = [
      { firstName: "Marek", lastName: "Kowalski", city: "Rotterdam", source: "indeed" as const, availabilityType: "direct" as const, availabilityStartDate: agencyToday, contractType: "uitzend" as const },
      { firstName: "Tomasz", lastName: "Nowak", city: "Den Haag", source: "facebook" as const, availabilityType: "direct" as const, availabilityStartDate: agencyToday, contractType: "uitzend" as const },
      { firstName: "Stefan", lastName: "Wisniewksi", city: "Amsterdam", source: "indeed" as const, availabilityType: "opzegtermijn" as const, availabilityStartDate: agencyTwoWeeks, contractType: "uitzend" as const },
      { firstName: "Ion", lastName: "Popescu", city: "Utrecht", source: "referral" as const, availabilityType: "direct" as const, availabilityStartDate: agencyToday, contractType: "tijdelijk" as const },
      { firstName: "Mihai", lastName: "Ionescu", city: "Eindhoven", source: "website" as const, availabilityType: "in_overleg" as const, availabilityStartDate: null, contractType: "uitzend" as const },
      { firstName: "Rob", lastName: "Janssen", city: "Groningen", source: "indeed" as const, availabilityType: "direct" as const, availabilityStartDate: agencyToday, contractType: "vast" as const },
      { firstName: "Bas", lastName: "Dekker", city: "Amersfoort", source: "marktplaats" as const, availabilityType: "opzegtermijn" as const, availabilityStartDate: agencyTwoWeeks, contractType: "zzp" as const },
      { firstName: "Peter", lastName: "van Dijk", city: "Breda", source: "indeed" as const, availabilityType: "direct" as const, availabilityStartDate: agencyToday, contractType: "uitzend" as const },
      { firstName: "Andrzej", lastName: "Zielinski", city: "Maastricht", source: "facebook" as const, availabilityType: "in_overleg" as const, availabilityStartDate: null, contractType: "uitzend" as const },
      { firstName: "Florin", lastName: "Dumitrescu", city: "Tilburg", source: "referral" as const, availabilityType: "direct" as const, availabilityStartDate: agencyToday, contractType: "tijdelijk" as const },
    ];

    const agencyCandidateIds: string[] = [];
    for (const c of agencyCandidateData) {
      const [inserted] = await tx
        .insert(candidates)
        .values({
          organizationId: AGENCY_ORG_ID,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: `+3161${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase().replace(/ /g, "")}@email.com`,
          city: c.city,
          source: c.source,
          availabilityType: c.availabilityType,
          availabilityStartDate: c.availabilityStartDate ? new Date(c.availabilityStartDate) : null,
          contractType: c.contractType,
        })
        .returning();
      agencyCandidateIds.push(inserted.id);
    }
    console.log("  Created 10 candidates");

    // Driver qualifications for agency candidates
    const agencyLicenseData = [
      { candidateIdx: 0, type: "CE" },
      { candidateIdx: 0, type: "code95" },
      { candidateIdx: 1, type: "CE" },
      { candidateIdx: 1, type: "code95" },
      { candidateIdx: 2, type: "C" },
      { candidateIdx: 3, type: "CE" },
      { candidateIdx: 3, type: "code95" },
      { candidateIdx: 3, type: "ADR" },
      { candidateIdx: 4, type: "C" },
      { candidateIdx: 4, type: "code95" },
      { candidateIdx: 5, type: "CE" },
      { candidateIdx: 5, type: "code95" },
      { candidateIdx: 6, type: "C" },
      { candidateIdx: 7, type: "CE" },
      { candidateIdx: 7, type: "code95" },
      { candidateIdx: 8, type: "CE" },
      { candidateIdx: 8, type: "code95" },
      { candidateIdx: 8, type: "ADR" },
      { candidateIdx: 9, type: "C" },
    ];

    for (const lic of agencyLicenseData) {
      await tx.insert(driverQualifications).values({
        organizationId: AGENCY_ORG_ID,
        candidateId: agencyCandidateIds[lic.candidateIdx],
        type: lic.type,
        issuedAt: "2019-06-01",
        expiresAt: lic.type === "code95" ? "2026-06-01" : null,
      });
    }
    console.log("  Created driver qualifications");

    // 15 applications distributed across stages
    const agencyAppMappings = [
      { candidateIdx: 0, vacancyId: vac1.id, stage: "sent-to-client" },
      { candidateIdx: 1, vacancyId: vac1.id, stage: "qualified" },
      { candidateIdx: 2, vacancyId: vac2.id, stage: "new" },
      { candidateIdx: 3, vacancyId: vac3.id, stage: "interview" },
      { candidateIdx: 4, vacancyId: vac3.id, stage: "contacted" },
      { candidateIdx: 5, vacancyId: vac1.id, stage: "hired" },
      { candidateIdx: 6, vacancyId: vac2.id, stage: "to-screen" },
      { candidateIdx: 7, vacancyId: vac4.id, stage: "new" },
      { candidateIdx: 8, vacancyId: vac3.id, stage: "qualified" },
      { candidateIdx: 9, vacancyId: vac4.id, stage: "contact-attempted" },
      { candidateIdx: 0, vacancyId: vac2.id, stage: "new" },
      { candidateIdx: 1, vacancyId: vac4.id, stage: "sent-to-client" },
      { candidateIdx: 3, vacancyId: vac1.id, stage: "new" },
      { candidateIdx: 5, vacancyId: vac4.id, stage: "qualified" },
      { candidateIdx: 8, vacancyId: vac1.id, stage: "to-screen" },
    ];

    const agencyAppIds: string[] = [];
    for (const app of agencyAppMappings) {
      const [inserted] = await tx.insert(candidateApplications).values({
        organizationId: AGENCY_ORG_ID,
        candidateId: agencyCandidateIds[app.candidateIdx],
        vacancyId: app.vacancyId,
        ownerId: demoUserId,
        currentStageId: stageRecords[app.stage],
        qualificationStatus:
          app.stage === "hired"
            ? "yes"
            : app.stage === "qualified" || app.stage === "sent-to-client"
              ? "yes"
              : "pending",
        sentToClient: app.stage === "sent-to-client",
        sourceDetail: "Demo seed",
      }).returning();
      agencyAppIds.push(inserted.id);
    }
    console.log("  Created 15 applications");

    // Create a placement for the hired candidate (Rob Janssen -> Chauffeur CE - Regio Noord)
    // This is mapping index 5 in agencyAppMappings: candidateIdx 5, vac1, stage "hired"
    const hiredAppId = agencyAppIds[5]; // Rob Janssen hired at vac1
    await tx.insert(placements).values({
      organizationId: AGENCY_ORG_ID,
      applicationId: hiredAppId,
      candidateId: agencyCandidateIds[5],
      vacancyId: vac1.id,
      clientId: client1.id,
      agreedRate: "23.00",
      inlenersbeloning: true,
      startDate: new Date(),
      notes: "Proefperiode 4 weken. Reiskostenvergoeding conform cao.",
      createdBy: demoUserId,
    });
    console.log("  Created 1 placement for hired candidate");

    // 6 tasks
    const now = new Date();
    const agencyTaskData = [
      { title: "Bel Marek Kowalski over status plaatsing", candidateIdx: 0, vacancyId: vac1.id, dueOffset: -2, priority: "high" as const },
      { title: "Stuur profiel Tomasz naar Van den Berg", candidateIdx: 1, vacancyId: vac1.id, dueOffset: -1, priority: "urgent" as const },
      { title: "Interview feedback opvragen bij De Vries", candidateIdx: 3, vacancyId: vac3.id, dueOffset: 0, priority: "high" as const },
      { title: "Documenten controleren Ion Popescu", candidateIdx: 3, vacancyId: null, dueOffset: 2, priority: "medium" as const },
      { title: "Nieuwe kandidaten sourcen voor CE vacature", candidateIdx: null, vacancyId: vac1.id, dueOffset: 4, priority: "medium" as const },
      { title: "Verloopdatum code 95 controleren team", candidateIdx: null, vacancyId: vac3.id, dueOffset: 7, priority: "low" as const },
    ];

    for (const t of agencyTaskData) {
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + t.dueOffset);

      await tx.insert(tasks).values({
        organizationId: AGENCY_ORG_ID,
        title: t.title,
        candidateId: t.candidateIdx !== null && t.vacancyId === null
          ? agencyCandidateIds[t.candidateIdx]
          : null,
        vacancyId: t.vacancyId,
        assignedToUserId: demoUserId,
        createdByUserId: demoUserId,
        dueDate,
        priority: t.priority,
        status: "open",
      });
    }
    console.log("  Created 6 tasks");

    // Qualification presets
    await tx.insert(qualificationPresets).values([
      {
        organizationId: AGENCY_ORG_ID,
        name: "CE Internationaal Transport",
        criteria: JSON.stringify([
          "Rijbewijs CE geldig",
          "Code 95 geldig",
          "Minimaal 2 jaar CE ervaring",
          "Digitachograafkaart",
          "Bereid tot internationaal werk",
        ]),
        isDefault: true,
      },
      {
        organizationId: AGENCY_ORG_ID,
        name: "ADR Chauffeur",
        criteria: JSON.stringify([
          "Rijbewijs CE geldig",
          "Code 95 geldig",
          "ADR certificaat geldig",
          "Minimaal 3 jaar ervaring gevaarlijke stoffen",
        ]),
        isDefault: false,
      },
    ]);
    console.log("  Created 2 qualification presets");
  });

  console.log("  Agency org seed complete");
}
