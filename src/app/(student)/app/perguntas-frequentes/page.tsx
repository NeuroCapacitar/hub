import { permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { route } from "@/lib/routes";

export default async function StudentFaqLegacyRoute(): Promise<never> {
  // Keep the authenticated legacy route out of build-time prerendering.
  await connection();
  permanentRedirect(route("/app/ajuda"));
}
