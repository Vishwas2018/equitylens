/**
 * PDF renderers — @react-pdf/renderer.
 *
 * MUST run in Node.js runtime (not Edge). Every document includes:
 *   1. Identification header (tenant, user, date, scenario)
 *   2. Provisional warning (draft ruleset)
 *   3. Report body (template-specific)
 *   4. Disclaimer footer on every page (structural — cannot be removed)
 *
 * If any page lacks the disclaimer, content-assertion tests fail.
 */

import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import React from 'react';

import { buildDisclaimerText } from './disclaimer';
import { buildIdentificationText } from './identification';
import type { CgtDisposalScope, PortfolioSummaryScope, RenderContext } from './types';

// Disable font registration — use built-in Helvetica for Day 12
Font.registerHyphenationCallback((w) => [w]);

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingHorizontal: 40,
    paddingTop: 30,
    paddingBottom: 80, // room for footer
    color: '#1a1a1a',
  },
  header: {
    fontSize: 7,
    color: '#555',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    paddingBottom: 6,
    marginBottom: 12,
    whiteSpace: 'pre',
  },
  provisionalBanner: {
    fontSize: 7,
    backgroundColor: '#fff7ed',
    borderWidth: 0.5,
    borderColor: '#f59e0b',
    padding: 6,
    marginBottom: 12,
    color: '#92400e',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    marginTop: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 8,
    borderBottomWidth: 0.25,
    borderBottomColor: '#e5e7eb',
  },
  col: { flex: 1 },
  colRight: { flex: 1, textAlign: 'right' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 0.25,
    borderBottomColor: '#e5e7eb',
    fontSize: 9,
  },
  summaryLabel: { color: '#555' },
  summaryValue: { fontFamily: 'Helvetica-Bold' },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 6,
    color: '#777',
    borderTopWidth: 0.5,
    borderTopColor: '#ccc',
    paddingTop: 4,
    whiteSpace: 'pre-wrap',
  },
});

function centsToAud(cents: number): string {
  const abs = Math.abs(Math.floor(cents / 100));
  const formatted = abs.toLocaleString('en-AU');
  return cents < 0 ? `($${formatted})` : `$${formatted}`;
}

function isoToHuman(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Shared page wrapper ───────────────────────────────────────────────────────

function PdfPage({ ctx, children }: { ctx: RenderContext; children: React.ReactNode }) {
  const idText = buildIdentificationText(ctx.identification);
  const disclaimerText = buildDisclaimerText(ctx.disclaimer);

  return (
    <Page size="A4" style={styles.page}>
      {/* Identification header */}
      <Text style={styles.header}>{idText}</Text>

      {/* Provisional warning — always shown while ruleset_status !== 'published' */}
      {ctx.disclaimer.rulesetStatus !== 'published' && (
        <Text style={styles.provisionalBanner}>
          PROVISIONAL ESTIMATE — {ctx.disclaimer.rulesetStatus} ruleset (
          {ctx.disclaimer.rulesetVersion}). Figures are estimates only. Consult a qualified tax
          adviser before acting on this output.
        </Text>
      )}

      {/* Page body */}
      {children}

      {/* Disclaimer footer — structural, present on every page */}
      <Text style={styles.footer}>{disclaimerText}</Text>
    </Page>
  );
}

// ── Portfolio summary PDF ─────────────────────────────────────────────────────

export async function renderPortfolioSummaryPdf(
  scope: PortfolioSummaryScope,
  ctx: RenderContext,
): Promise<Buffer> {
  const doc = (
    <Document author="EquityLens Pty Ltd" title="Portfolio Summary">
      <PdfPage ctx={ctx}>
        <Text style={styles.title}>Portfolio Summary</Text>

        <View style={styles.tableHeader}>
          <Text style={styles.col}>Address</Text>
          <Text style={styles.col}>Suburb</Text>
          <Text style={styles.col}>State</Text>
          <Text style={styles.col}>Status</Text>
          <Text style={styles.colRight}>Purchase Price</Text>
          <Text style={styles.colRight}>Est. Value</Text>
        </View>

        {scope.properties.map((p, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.col}>{p.address}</Text>
            <Text style={styles.col}>{p.suburb}</Text>
            <Text style={styles.col}>{p.state}</Text>
            <Text style={styles.col}>{p.status}</Text>
            <Text style={styles.colRight}>{centsToAud(p.purchasePriceCents)}</Text>
            <Text style={styles.colRight}>{centsToAud(p.estimatedValueCents)}</Text>
          </View>
        ))}

        <View style={[styles.tableRow, { marginTop: 4, fontFamily: 'Helvetica-Bold' }]}>
          <Text style={styles.col}>TOTAL ({scope.activeCount} active)</Text>
          <Text style={styles.col} />
          <Text style={styles.col} />
          <Text style={styles.col} />
          <Text style={styles.colRight}>{centsToAud(scope.totalPurchasePriceCents)}</Text>
          <Text style={styles.colRight}>{centsToAud(scope.totalEstimatedValueCents)}</Text>
        </View>
      </PdfPage>
    </Document>
  );

  return Buffer.from(await renderToBuffer(doc));
}

// ── CGT disposal PDF ──────────────────────────────────────────────────────────

export async function renderCgtDisposalPdf(
  scope: CgtDisposalScope,
  ctx: RenderContext,
): Promise<Buffer> {
  const doc = (
    <Document author="EquityLens Pty Ltd" title={`CGT Disposal — ${scope.scenarioLabel}`}>
      <PdfPage ctx={ctx}>
        <Text style={styles.title}>CGT Disposal — {scope.scenarioLabel}</Text>

        <Text style={styles.sectionTitle}>Disposal Details</Text>

        {[
          ['Acquisition date', isoToHuman(scope.acquisitionDateISO)],
          ['Disposal date', isoToHuman(scope.disposalDateISO)],
          ['Days held', scope.daysHeld.toLocaleString()],
          ['Total cost base (elements 1–5)', centsToAud(scope.totalCostBaseCents)],
          ['Net proceeds', centsToAud(scope.netProceedsCents)],
          [
            scope.isCapitalLoss ? 'Capital loss' : 'Gross capital gain',
            centsToAud(scope.grossGainCents),
          ],
          ['CGT discount eligible', scope.discountEligible ? 'Yes' : 'No'],
          ['Pre-CGT asset', scope.isPreCgtAsset ? 'Yes — exempt' : 'No'],
          ['Ruleset', `${scope.rulesetVersion} (${scope.rulesetStatus})`],
        ].map(([label, value], i) => (
          <View key={i} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={styles.summaryValue}>{value}</Text>
          </View>
        ))}

        {scope.owners.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Per-Owner Breakdown</Text>

            <View style={styles.tableHeader}>
              <Text style={styles.col}>Entity</Text>
              <Text style={styles.colRight}>Share</Text>
              <Text style={styles.colRight}>Gross Gain</Text>
              <Text style={styles.colRight}>Discount</Text>
              <Text style={styles.colRight}>Taxable Gain</Text>
            </View>

            {scope.owners.map((o, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.col}>{o.entityType}</Text>
                <Text style={styles.colRight}>{o.sharePct.toFixed(0)}%</Text>
                <Text style={styles.colRight}>{centsToAud(o.grossGainCents)}</Text>
                <Text style={styles.colRight}>{centsToAud(o.discountAppliedCents)}</Text>
                <Text style={styles.colRight}>{centsToAud(o.taxableGainCents)}</Text>
              </View>
            ))}
          </>
        )}
      </PdfPage>
    </Document>
  );

  return Buffer.from(await renderToBuffer(doc));
}
