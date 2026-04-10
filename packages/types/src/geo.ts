export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodedEntity {
  latitude: string | null; // numeric stored as string in Drizzle
  longitude: string | null;
  geocodedAt: Date | null;
}

export interface RadiusSearchParams {
  vacancyId: string;
  radiusKm: number;
}

export interface CandidateWithDistance {
  candidateId: string;
  firstName: string;
  lastName: string;
  city: string | null;
  distanceKm: number;
}
