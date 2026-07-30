export type SystemHealthStatus = {
  status: "healthy";
  runtime: "sites";
  database: "connected";
  objectStorage: "bound" | "missing";
  latencyMs: {
    database: number;
  };
  timestamp: string;
};
