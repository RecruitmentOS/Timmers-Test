export type DistributionChannel = 'indeed' | 'marktplaats' | 'google_for_jobs' | 'direct';

export interface DistributionChannels {
  indeed?: boolean;
  marktplaats?: boolean;
  google_for_jobs?: boolean;
  [key: string]: boolean | undefined;
}
