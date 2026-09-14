import { NextResponse } from "next/server";
import { getAdminAuthMediaImageKey } from "@/features/auth-media/server";
import { createR2ObjectReadUrl } from "@/features/storage/r2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slideId: string }> }
): Promise<NextResponse> {
  const { slideId } = await params;
  const imageKey = await getAdminAuthMediaImageKey(slideId);

  if (!imageKey) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const signedUrl = await createR2ObjectReadUrl({ key: imageKey });
  return NextResponse.redirect(signedUrl);
}
