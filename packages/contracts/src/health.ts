export type SystemHealthStatus = {
  status: "healthy";
  database: "connected";
  valkey: "connected" | "not_required";
  runtime?: "node" | "sites";
  latencyMs: {
    database: number;
    valkey: number;
  };
  timestamp: string;
};
