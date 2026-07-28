declare global {
  namespace Express {
    interface Request {
      requestId: string;
      adminSession?: {
        sessionId: string;
        userId: string;
        email: string;
        displayName: string;
        permissions: ReadonlySet<string>;
        csrfToken: string;
        reauthenticatedAt: number | null;
      };
    }
  }
}

export {};
