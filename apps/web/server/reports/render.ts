/**
 * Render dispatcher — entry point for the worker.
 *
 * Takes a job context + scope JSON and returns rendered artifact bytes.
 * Disclaimer + identification header are enforced structurally at this layer;
 * the worker does not need to check for their presence.
 */

import { renderCashflowAnnualCsv, renderCgtDisposalCsv, renderPortfolioSummaryCsv } from './csv';
import type { RenderContext, RenderedArtifact } from './types';

export { type RenderContext };

export class UnsupportedTemplateError extends Error {
  constructor(slug: string, format: string) {
    super(`Unsupported template/format: ${slug}/${format}`);
  }
}

export async function renderArtifact(
  templateSlug: string,
  format: 'pdf' | 'csv',
  scopeJson: string,
  ctx: RenderContext,
): Promise<RenderedArtifact> {
  const scope: unknown = JSON.parse(scopeJson);

  if (format === 'csv') {
    let bytes: Buffer;

    switch (templateSlug) {
      case 'portfolio-summary': {
        bytes = renderPortfolioSummaryCsv(
          scope as Parameters<typeof renderPortfolioSummaryCsv>[0],
          ctx,
        );
        break;
      }
      case 'cashflow-annual': {
        bytes = renderCashflowAnnualCsv(
          scope as Parameters<typeof renderCashflowAnnualCsv>[0],
          ctx,
        );
        break;
      }
      case 'cgt-disposal': {
        bytes = renderCgtDisposalCsv(scope as Parameters<typeof renderCgtDisposalCsv>[0], ctx);
        break;
      }
      default:
        throw new UnsupportedTemplateError(templateSlug, format);
    }

    // Verify disclaimer is present in every CSV output
    assertDisclaimerPresent(bytes, templateSlug, 'csv');

    return { bytes, mimeType: 'text/csv; charset=utf-8', extension: 'csv' };
  }

  if (format === 'pdf') {
    // PDF renderer uses @react-pdf/renderer (Node.js only — not Edge)
    const { renderPortfolioSummaryPdf, renderCgtDisposalPdf } = await import('./pdf');
    let bytes: Buffer;

    switch (templateSlug) {
      case 'portfolio-summary': {
        bytes = await renderPortfolioSummaryPdf(
          scope as Parameters<typeof renderPortfolioSummaryPdf>[0],
          ctx,
        );
        break;
      }
      case 'cgt-disposal': {
        bytes = await renderCgtDisposalPdf(
          scope as Parameters<typeof renderCgtDisposalPdf>[0],
          ctx,
        );
        break;
      }
      default:
        throw new UnsupportedTemplateError(templateSlug, format);
    }

    assertDisclaimerPresent(bytes, templateSlug, 'pdf');

    return { bytes, mimeType: 'application/pdf', extension: 'pdf' };
  }

  throw new UnsupportedTemplateError(templateSlug, format);
}

/**
 * Structural disclaimer check.
 *
 * For CSVs: sentinel appears in the plaintext comment block.
 * For PDFs: PDF content streams are FlateDecode-compressed so the footer
 * text is not searchable in raw bytes. Instead, Document.author is set to
 * the sentinel in pdf.tsx; this lands in the PDF info dictionary, which is
 * always stored uncompressed as a literal string in the raw bytes.
 * Throws if absent — this failure is fatal and must not be swallowed.
 */
function assertDisclaimerPresent(bytes: Buffer, templateSlug: string, format: string): void {
  const text = bytes.toString('utf8');
  // Sentinel appears in: CSV comment block (all templates) and PDF info
  // dictionary /Author field (set in pdf.tsx Document component).
  const sentinel = 'EquityLens Pty Ltd';
  if (!text.includes(sentinel)) {
    throw new Error(
      `MissingDisclaimerError: disclaimer absent from ${templateSlug}/${format} artifact. ` +
        `Expected sentinel "${sentinel}" not found in rendered output.`,
    );
  }
}
