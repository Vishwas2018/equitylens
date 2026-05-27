/**
 * Identification header — present on every artifact alongside the disclaimer.
 * Full email is never printed; only first char + domain shown.
 */

export interface IdentificationContext {
  templateHumanName: string;
  tenantDisplayName: string;
  userDisplayName: string;
  userEmail: string;
  generatedAtHuman: string;
  scenarioName: string;
  scenarioId: string;
}

function maskEmail(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx <= 0) return '***@***';
  return `${email[0]}***${email.slice(atIdx)}`;
}

export function buildIdentificationText(ctx: IdentificationContext): string {
  return `EquityLens — ${ctx.templateHumanName}
Prepared for: ${ctx.tenantDisplayName}
User:         ${ctx.userDisplayName} (${maskEmail(ctx.userEmail)})
Date:         ${ctx.generatedAtHuman}
Scenario:     ${ctx.scenarioName} (${ctx.scenarioId})`;
}

export function buildCsvIdentificationLines(ctx: IdentificationContext): string {
  return buildIdentificationText(ctx)
    .split('\n')
    .map((line) => `# ${line}`)
    .join('\r\n');
}
