declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string;
      roles: Array<{
        key: string;
        channelId?: string;
        creatorProfileId?: string;
      }>;
    };
  }
}
