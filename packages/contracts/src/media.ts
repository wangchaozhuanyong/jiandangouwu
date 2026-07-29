export type AdminManagedMediaObject = {
  key: string;
  path: string;
  fileName: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  uploadedByEmail: string;
  createdAt: string;
  storageStatus: "AVAILABLE" | "MISSING";
  productReferences: number;
  heroReferences: number;
};

export type AdminMediaReplacement = {
  sourcePath: string;
  media: AdminManagedMediaObject;
  replacedReferences: {
    products: number;
    heroes: number;
  };
};
