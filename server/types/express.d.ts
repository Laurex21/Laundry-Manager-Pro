declare global {
  namespace Express {
    interface Request {
      userId?: string;
      siteId?: number | null;
      siteRole?: string | null;
      organisationId?: number | null;
    }
  }
}

export {};
