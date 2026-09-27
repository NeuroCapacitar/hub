import "server-only";
import {
  deletePublicR2Objects,
  deleteR2Objects,
  publishR2Object,
} from "@/features/storage/r2";

const setPublicState = async (
  key: string,
  isActive: boolean
): Promise<void> => {
  if (isActive) {
    await publishR2Object(key);
    return;
  }

  await deletePublicR2Objects([key]);
};

export const persistDashboardBannerObjects = async ({
  isActive,
  newImageUploaded,
  nextImageKey,
  persist,
  previousImageKey,
  previousIsActive,
}: {
  isActive: boolean;
  newImageUploaded: boolean;
  nextImageKey: string;
  persist: () => Promise<boolean | undefined>;
  previousImageKey: string | null;
  previousIsActive: boolean;
}): Promise<void> => {
  if (newImageUploaded && previousImageKey === nextImageKey) {
    throw new Error("A nova imagem do banner deve ter uma chave exclusiva.");
  }

  try {
    await setPublicState(nextImageKey, isActive);
    const persisted = await persist();
    if (persisted === false) {
      throw new Error(
        "O Banner foi alterado em outra sessão. Atualize a página."
      );
    }
  } catch (error) {
    if (newImageUploaded) {
      await Promise.allSettled([
        deletePublicR2Objects([nextImageKey]),
        deleteR2Objects([nextImageKey]),
      ]);
    } else if (previousImageKey) {
      try {
        await setPublicState(previousImageKey, previousIsActive);
      } catch {
        // Preserve the database/storage failure that triggered compensation.
      }
    }
    throw error;
  }
};
