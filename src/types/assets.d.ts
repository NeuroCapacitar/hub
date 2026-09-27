declare module "*.svg" {
  const asset: string | { readonly src: string };

  export default asset;
}
