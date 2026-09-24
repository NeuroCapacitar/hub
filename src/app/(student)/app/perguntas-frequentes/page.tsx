import { permanentRedirect } from "next/navigation";
import { route } from "@/lib/routes";

export default function StudentFaqLegacyRoute(): never {
  permanentRedirect(route("/app/ajuda"));
}
