export interface ObjectUrlRegistry {
  create: (blob: Blob) => string;
  revoke: (url: string) => void;
  revokeAll: () => void;
}

export const createObjectUrlRegistry = (
  urlApi: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL
): ObjectUrlRegistry => {
  const ownedUrls = new Set<string>();

  return {
    create: (blob) => {
      const url = urlApi.createObjectURL(blob);
      ownedUrls.add(url);
      return url;
    },
    revoke: (url) => {
      if (ownedUrls.delete(url)) {
        urlApi.revokeObjectURL(url);
      }
    },
    revokeAll: () => {
      for (const url of ownedUrls) {
        urlApi.revokeObjectURL(url);
      }
      ownedUrls.clear();
    },
  };
};
