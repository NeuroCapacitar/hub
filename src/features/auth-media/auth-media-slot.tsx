import { AuthMediaCarousel } from "./auth-media-carousel";
import { getActiveAuthMediaData } from "./server";

export async function AuthMediaSlot(): Promise<React.JSX.Element> {
  try {
    const { slides } = await getActiveAuthMediaData();
    return <AuthMediaCarousel slides={slides} />;
  } catch {
    return <AuthMediaCarousel slides={[]} />;
  }
}
