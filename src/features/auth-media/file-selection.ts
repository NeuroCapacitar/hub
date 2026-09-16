export const readAuthMediaFileSelection = (
  files: File[] | FileList
): File[] => {
  if (files.length === 0) {
    throw new Error("Selecione ao menos uma imagem.");
  }

  const selectedFiles = Array.from(files);
  if (selectedFiles.some((file) => !file)) {
    throw new Error("Não foi possível ler as imagens selecionadas.");
  }

  return selectedFiles;
};
