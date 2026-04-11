declare module "facebook-nodejs-business-sdk" {
  export class FacebookAdsApi {
    static init(accessToken: string): FacebookAdsApi;
  }

  export class AdAccount {
    constructor(id: string);
    read(fields: string[]): Promise<Record<string, any>>;
    createCampaign(fields: string[], params: Record<string, any>): Promise<{ id: string }>;
    createAdSet(fields: string[], params: Record<string, any>): Promise<{ id: string }>;
    createAdCreative(fields: string[], params: Record<string, any>): Promise<{ id: string }>;
    createAd(fields: string[], params: Record<string, any>): Promise<{ id: string }>;
  }

  export class Campaign {
    constructor(id: string);
    read(fields: string[]): Promise<Record<string, any>>;
    update(fields: string[], params: Record<string, any>): Promise<void>;
    getInsights(fields: string[], params: Record<string, any>): Promise<any[]>;
  }
}
