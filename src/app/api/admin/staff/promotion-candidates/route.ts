import { getStaffPromotionCandidates } from "@/features/admin/staff-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const result = await getStaffPromotionCandidates(
    requestUrl.searchParams.get("q") ?? ""
  );

  return Response.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
