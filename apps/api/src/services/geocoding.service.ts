import { sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { candidates } from "../db/schema/candidates.js";
import { vacancies } from "../db/schema/vacancies.js";
import { eq } from "drizzle-orm";
import type {
  GeoCoordinates,
  CandidateWithDistance,
} from "@recruitment-os/types";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "RecruitmentOS/1.0 (contact@recruitment-os.nl)";

/**
 * Rate limiter: Nominatim requires max 1 request/sec.
 * Track last request time and delay if needed.
 */
let lastNominatimRequest = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastNominatimRequest;
  if (elapsed < 1100) {
    await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
  }
  lastNominatimRequest = Date.now();
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
}

export const geocodingService = {
  /**
   * Geocode a free-text query via Nominatim (OpenStreetMap).
   * Returns coordinates or null if no result found.
   * Rate-limited to 1 req/sec per Nominatim usage policy.
   */
  async geocode(query: string): Promise<GeoCoordinates | null> {
    try {
      const url = new URL(NOMINATIM_BASE);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "nl,be");

      const res = await rateLimitedFetch(url.toString());

      if (!res.ok) {
        console.error(
          `[geocoding] Nominatim returned ${res.status} for query "${query}"`
        );
        return null;
      }

      const results = (await res.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;

      if (!results || results.length === 0) {
        console.log(`[geocoding] No results for query "${query}"`);
        return null;
      }

      const { lat, lon } = results[0];
      const coords: GeoCoordinates = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
      };

      console.log(
        `[geocoding] "${query}" → ${coords.latitude}, ${coords.longitude}`
      );
      return coords;
    } catch (err) {
      console.error(`[geocoding] Error geocoding "${query}":`, err);
      return null;
    }
  },

  /**
   * Geocode a candidate by their city field.
   * Updates latitude, longitude, geocodedAt in the database.
   */
  async geocodeCandidate(
    orgId: string,
    candidateId: string,
    city: string
  ): Promise<GeoCoordinates | null> {
    const coords = await this.geocode(city);
    if (!coords) return null;

    await withTenantContext(orgId, async (tx) => {
      await tx
        .update(candidates)
        .set({
          latitude: coords.latitude.toFixed(7),
          longitude: coords.longitude.toFixed(7),
          geocodedAt: new Date(),
        })
        .where(eq(candidates.id, candidateId));
    });

    return coords;
  },

  /**
   * Geocode a vacancy by its location field.
   * Updates latitude, longitude, geocodedAt in the database.
   */
  async geocodeVacancy(
    orgId: string,
    vacancyId: string,
    location: string
  ): Promise<GeoCoordinates | null> {
    const coords = await this.geocode(location);
    if (!coords) return null;

    await withTenantContext(orgId, async (tx) => {
      await tx
        .update(vacancies)
        .set({
          latitude: coords.latitude.toFixed(7),
          longitude: coords.longitude.toFixed(7),
          geocodedAt: new Date(),
        })
        .where(eq(vacancies.id, vacancyId));
    });

    return coords;
  },

  /**
   * Find candidates within a radius (km) of a vacancy using Haversine formula.
   * Uses a bounding box pre-filter for performance, then exact Haversine calculation.
   */
  async searchByRadius(
    orgId: string,
    vacancyId: string,
    radiusKm: number
  ): Promise<CandidateWithDistance[]> {
    return withTenantContext(orgId, async (tx) => {
      const result = await tx.execute<{
        candidateId: string;
        firstName: string;
        lastName: string;
        city: string | null;
        distanceKm: number;
      }>(
        sql`
          SELECT
            c.id AS "candidateId",
            c.first_name AS "firstName",
            c.last_name AS "lastName",
            c.city,
            (6371 * acos(
              LEAST(1.0, cos(radians(v.latitude::float)) * cos(radians(c.latitude::float)) *
              cos(radians(c.longitude::float) - radians(v.longitude::float)) +
              sin(radians(v.latitude::float)) * sin(radians(c.latitude::float)))
            )) AS "distanceKm"
          FROM candidates c, vacancies v
          WHERE v.id = ${vacancyId}
            AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
            AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
            AND c.latitude::float BETWEEN (v.latitude::float - ${radiusKm}/111.0) AND (v.latitude::float + ${radiusKm}/111.0)
            AND c.longitude::float BETWEEN (v.longitude::float - ${radiusKm}/(111.0 * cos(radians(v.latitude::float)))) AND (v.longitude::float + ${radiusKm}/(111.0 * cos(radians(v.latitude::float))))
            AND (6371 * acos(
              LEAST(1.0, cos(radians(v.latitude::float)) * cos(radians(c.latitude::float)) *
              cos(radians(c.longitude::float) - radians(v.longitude::float)) +
              sin(radians(v.latitude::float)) * sin(radians(c.latitude::float)))
            )) <= ${radiusKm}
          ORDER BY "distanceKm"
        `
      );

      return result as unknown as CandidateWithDistance[];
    });
  },

  /**
   * Get distance in km between a specific candidate and vacancy.
   * Returns null if either entity is not geocoded.
   */
  async getDistanceForCandidate(
    orgId: string,
    candidateId: string,
    vacancyId: string
  ): Promise<number | null> {
    return withTenantContext(orgId, async (tx) => {
      const result = await tx.execute<{ distanceKm: number }>(
        sql`
          SELECT
            (6371 * acos(
              LEAST(1.0, cos(radians(v.latitude::float)) * cos(radians(c.latitude::float)) *
              cos(radians(c.longitude::float) - radians(v.longitude::float)) +
              sin(radians(v.latitude::float)) * sin(radians(c.latitude::float)))
            )) AS "distanceKm"
          FROM candidates c, vacancies v
          WHERE c.id = ${candidateId}
            AND v.id = ${vacancyId}
            AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
            AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
        `
      );

      const rows = result as unknown as Array<{ distanceKm: number }>;
      return rows.length > 0 ? Number(rows[0].distanceKm) : null;
    });
  },
};
