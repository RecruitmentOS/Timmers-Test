/**
 * Realistic Dutch transport candidate fixtures for testing.
 * Contains driver-specific fields: license types, code 95, ADR, digitachograaf.
 */

export interface CandidateFixture {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverQualificationFixture {
  id: string;
  candidateId: string;
  organizationId: string;
  type: string;
  adrType: string | null;
  expiresAt: string | null;
  issuedAt: string | null;
  documentNumber: string | null;
}

export function createCandidateFixture(
  overrides: Partial<CandidateFixture> = {}
): CandidateFixture {
  return {
    id: "c0000000-0000-0000-0000-000000000001",
    organizationId: "a0000000-0000-0000-0000-000000000001",
    firstName: "Jan",
    lastName: "de Vries",
    email: "jan.devries@gmail.com",
    phone: "+31612345678",
    city: "Rotterdam",
    source: "apply-page",
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    ...overrides,
  };
}

export function createDriverQualificationFixture(
  overrides: Partial<DriverQualificationFixture> = {}
): DriverQualificationFixture {
  return {
    id: "dq000000-0000-0000-0000-000000000001",
    candidateId: "c0000000-0000-0000-0000-000000000001",
    organizationId: "a0000000-0000-0000-0000-000000000001",
    type: "CE",
    adrType: null,
    expiresAt: "2028-06-15",
    issuedAt: "2020-03-10",
    documentNumber: "NL-CE-2020-45678",
    ...overrides,
  };
}

// Pre-built candidates with variety

/** Valid CE driver with code 95 and ADR full */
export const validCEDriver = createCandidateFixture({
  id: "c0000000-0000-0000-0000-000000000001",
  firstName: "Jan",
  lastName: "de Vries",
  email: "jan.devries@gmail.com",
  phone: "+31612345678",
  city: "Rotterdam",
});

export const validCEDriverQualifications: DriverQualificationFixture[] = [
  createDriverQualificationFixture({
    id: "dq000000-0000-0000-0000-000000000001",
    candidateId: validCEDriver.id,
    type: "CE",
    expiresAt: "2028-06-15",
  }),
  createDriverQualificationFixture({
    id: "dq000000-0000-0000-0000-000000000002",
    candidateId: validCEDriver.id,
    type: "code95",
    expiresAt: "2027-12-01",
  }),
  createDriverQualificationFixture({
    id: "dq000000-0000-0000-0000-000000000003",
    candidateId: validCEDriver.id,
    type: "ADR",
    adrType: "full",
    expiresAt: "2029-03-20",
  }),
];

/** C driver with expired license */
export const expiredLicenseDriver = createCandidateFixture({
  id: "c0000000-0000-0000-0000-000000000002",
  firstName: "Pieter",
  lastName: "Bakker",
  email: "pieter.bakker@hotmail.nl",
  phone: "+31687654321",
  city: "Venlo",
});

export const expiredDriverQualifications: DriverQualificationFixture[] = [
  createDriverQualificationFixture({
    id: "dq000000-0000-0000-0000-000000000004",
    candidateId: expiredLicenseDriver.id,
    type: "C",
    expiresAt: "2024-01-01", // Expired
  }),
];

/** Candidate with no driver licenses */
export const noLicenseCandidate = createCandidateFixture({
  id: "c0000000-0000-0000-0000-000000000003",
  firstName: "Mohammed",
  lastName: "El Amrani",
  email: "m.elamrani@outlook.com",
  phone: "+31620001234",
  city: "Amsterdam",
});

/** Polish driver (multilingual test case) */
export const polishDriver = createCandidateFixture({
  id: "c0000000-0000-0000-0000-000000000004",
  firstName: "Krzysztof",
  lastName: "Kowalski",
  email: "k.kowalski@wp.pl",
  phone: "+48501234567",
  city: "Den Haag",
});

export const polishDriverQualifications: DriverQualificationFixture[] = [
  createDriverQualificationFixture({
    id: "dq000000-0000-0000-0000-000000000005",
    candidateId: polishDriver.id,
    type: "CE",
    expiresAt: "2027-09-01",
  }),
  createDriverQualificationFixture({
    id: "dq000000-0000-0000-0000-000000000006",
    candidateId: polishDriver.id,
    type: "code95",
    expiresAt: "2027-09-01",
  }),
];

/** Minimal candidate with only B license */
export const bLicenseOnly = createCandidateFixture({
  id: "c0000000-0000-0000-0000-000000000005",
  firstName: "Sophie",
  lastName: "Jansen",
  email: "sophie.jansen@gmail.com",
  phone: "+31698765432",
  city: "Utrecht",
});

export const bLicenseQualifications: DriverQualificationFixture[] = [
  createDriverQualificationFixture({
    id: "dq000000-0000-0000-0000-000000000007",
    candidateId: bLicenseOnly.id,
    type: "B",
    expiresAt: "2030-11-20",
  }),
];
