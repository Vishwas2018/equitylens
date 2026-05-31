import { NextRequest, NextResponse } from 'next/server';

import { explainScenario } from '../../../../../server/ai/gateway';
import { getApiSession, notFound, unauthorised } from '../../../../../server/auth/api-guard';
import { getLatestScenarioResult, getScenario } from '../../../../../server/data/scenarios';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  const { data: scenario, error: scenarioErr } = await getScenario(id, sess);
  if (scenarioErr || !scenario) return notFound();

  const { data: result } = await getLatestScenarioResult(id, sess);
  if (!result) {
    return NextResponse.json(
      { error: 'No completed scenario result found. Run the scenario first.' },
      { status: 422 },
    );
  }

  const explainResult = await explainScenario({ userId: sess.userId, result });

  if (!explainResult.ok) {
    return NextResponse.json({ error: explainResult.error }, { status: 500 });
  }

  if (explainResult.suppressed) {
    return NextResponse.json({ suppressed: true, reason: explainResult.reason }, { status: 200 });
  }

  return NextResponse.json(
    { explanation: explainResult.explanation, provider: explainResult.provider },
    { status: 200 },
  );
}
