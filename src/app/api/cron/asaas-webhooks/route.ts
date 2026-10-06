import { NextResponse } from "next/server";
import { getScheduledJobEarlyResponse } from "@/features/operations/scheduled-job-request";
import { runOutboxJob } from "@/features/outbox/outbox-job";
import { runAsaasWebhookJob } from "@/features/payments/asaas-webhook-job";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
} from "@/lib/observability";
import { observeOperation } from "@/lib/observe-operation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

export const GET = async (request: Request): Promise<Response> => {
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  const earlyResponse = getScheduledJobEarlyResponse(request);
  if (earlyResponse) {
    return earlyResponse;
  }
  if (!getServerEnv().ASAAS_WEBHOOK_ENABLED) {
    return NextResponse.json({
      ok: true,
      reason: "asaas_webhook_disabled",
      skipped: true,
    });
  }

  const result = await observeOperation({
    correlationId,
    execute: async () => {
      const paymentResult = await runAsaasWebhookJob();
      if (!("skipped" in paymentResult) && paymentResult.processed > 0) {
        await runOutboxJob({
          deadlineMs: 15_000,
          limit: 5,
        });
      }
      return paymentResult;
    },
    failureErrorCode: "asaas_webhook_worker_failed",
    operation: "cron.asaas-webhooks",
    provider: "asaas",
  });

  return NextResponse.json({ ok: true, ...result });
};
