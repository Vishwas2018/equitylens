#!/usr/bin/env bash
# Migration script: restructure flat docs/ tree and rename PWI → EquityLens.
# Run from the project root (the directory that contains docs/).
# Safe to run multiple times: moves only happen if the source exists.

set -euo pipefail

if [ ! -d "docs" ]; then
  echo "ERROR: run this from the project root (docs/ not found here)"
  exit 1
fi

cd docs

echo "==> Creating target directories"
mkdir -p product architecture database engine ui-ux operations reports-exports
mkdir -p process/templates process/registers/adr

# ------------------------------------------------------------------
# 1. Move files into the correct subdirectories
# ------------------------------------------------------------------

move() { [ -f "$1" ] && git mv -f "$1" "$2" 2>/dev/null || mv -f "$1" "$2"; }

echo "==> Moving product specs"
move prd.md                       product/prd.md
move user-flows.md                product/user-flows.md
move pricing-and-gating.md        product/pricing-and-gating.md

echo "==> Moving architecture docs"
move system-architecture.md       architecture/system-architecture.md
move api-contracts.md             architecture/api-contracts.md
move ai-integration.md            architecture/ai-integration.md
move security-and-compliance.md   architecture/security-and-compliance.md

echo "==> Moving database files"
move schema.sql                   database/schema.sql
move rls-policies.sql             database/rls-policies.sql
move types.ts                     database/types.ts
move indexing-and-partitioning.md database/indexing-and-partitioning.md

echo "==> Moving engine docs"
move financial-calc-engine.md     engine/financial-calc-engine.md
move tax-rule-versioning.md       engine/tax-rule-versioning.md
move test-matrix.md               engine/test-matrix.md

echo "==> Moving UI/UX docs"
move design-system.md             ui-ux/design-system.md
move dashboard-layouts.md         ui-ux/dashboard-layouts.md
move data-viz-guidelines.md       ui-ux/data-viz-guidelines.md

echo "==> Moving operations docs"
move ci-cd-pipeline.md            operations/ci-cd-pipeline.md
move deployment-checklist.md      operations/deployment-checklist.md
move monitoring-and-observability.md operations/monitoring-and-observability.md

echo "==> Moving reports/exports docs"
move export-templates.md          reports-exports/export-templates.md
move scheduling-and-delivery.md   reports-exports/scheduling-and-delivery.md

echo "==> Moving process docs"
move execution-system.md          process/execution-system.md
move 15-day-plan.md               process/15-day-plan.md
move daily-ritual.md              process/daily-ritual.md
move README.md                    process/README.md          # current top-level README is the process README
move cctv-audit-report.md         process/templates/cctv-audit-report.md
move daily-execution-prompt.md    process/templates/daily-execution-prompt.md
move end-of-day-report.md         process/templates/end-of-day-report.md
move product-backlog.md           process/registers/product-backlog.md
move defect-log.md                process/registers/defect-log.md
move deviation-log.md             process/registers/deviation-log.md
move daily-progress-log.md        process/registers/daily-progress-log.md
move technical-debt.md            process/registers/technical-debt.md
move adr-index.md                 process/registers/adr-index.md
move 0000-template.md             process/registers/adr/0000-template.md

# ------------------------------------------------------------------
# 2. Global rename: PWI / Property Wealth Intelligence → EquityLens
#    Adjust the three CONFIG values below if you prefer different
#    package scope / schema / domain.
# ------------------------------------------------------------------

PKG_SCOPE="equitylens"           # package scope:  @equitylens/...
DB_SCHEMA="equitylens"           # postgres schema: equitylens.<table>
DOMAIN="equitylens.com.au"       # primary domain
REPO_NAME="equitylens"           # repo / project name

cd ..   # back to project root so we can also touch any non-docs files

echo "==> Renaming PWI → EquityLens across docs/"

# Use perl for portable in-place edits (macOS/Linux safe).
find docs -type f \( -name "*.md" -o -name "*.sql" -o -name "*.ts" -o -name "*.yml" -o -name "*.yaml" -o -name "*.json" -o -name "*.toml" \) -print0 | \
  xargs -0 perl -i -pe '
    s/Property Wealth Intelligence Pty Ltd/EquityLens Pty Ltd/g;
    s/Property Wealth Intelligence \("PWI"\)/EquityLens/g;
    s/Property Wealth Intelligence/EquityLens/g;
    s/\bPWI\b/EquityLens/g;
    s/\@pwi\//\@'"$PKG_SCOPE"'\//g;
    s/\bpwi\./'"$DB_SCHEMA"'\./g;
    s/pwi-platform/'"$REPO_NAME"'/g;
    s/propertywealth\.au/'"$DOMAIN"'/g;
    s/app\.propertywealth\.au/app.'"$DOMAIN"'/g;
    s/staging\.propertywealth\.au/staging.'"$DOMAIN"'/g;
    s/privacy\@propertywealth\.au/privacy@'"$DOMAIN"'/g;
    s/synthetics\@propertywealth\.au/synthetics@'"$DOMAIN"'/g;
    s/grafana\.internal\.propertywealth\.au/grafana.internal.'"$DOMAIN"'/g;
  '

# ------------------------------------------------------------------
# 3. Drop a minimal top-level docs README pointing at the new layout
# ------------------------------------------------------------------

cat > docs/README.md <<'EOF'
# EquityLens — Documentation

Specification, process, and runbooks for the EquityLens platform.

## Start Here

- **`process/README.md`** — how the build is run (15-day ritual, registers, roles)
- **`process/15-day-plan.md`** — the day-by-day spine
- **`product/prd.md`** — product definition

## Map

| Area              | Folder                |
| ----------------- | --------------------- |
| Product           | `product/`            |
| Architecture      | `architecture/`       |
| Database          | `database/`           |
| Engine (finance)  | `engine/`             |
| UI / UX           | `ui-ux/`              |
| Operations        | `operations/`         |
| Reports & exports | `reports-exports/`    |
| Build process     | `process/`            |

Every doc cross-references others via leading-slash paths (e.g.
`/architecture/api-contracts.md`), interpreted relative to `docs/`.
EOF

# ------------------------------------------------------------------
# 4. Verification
# ------------------------------------------------------------------

echo
echo "==> Final file count (expect 37: 36 originals + new docs/README.md)"
find docs -type f | wc -l

echo
echo "==> Files still at docs root (should only be README.md)"
find docs -maxdepth 1 -type f

echo
echo "==> Any remaining 'PWI' references?"
grep -RIn --color=never "\bPWI\b" docs || echo "  (none — clean)"

echo
echo "==> Any remaining 'pwi.' SQL schema refs?"
grep -RIn --color=never "\bpwi\." docs || echo "  (none — clean)"

echo
echo "==> Any remaining 'propertywealth' references?"
grep -RIn --color=never "propertywealth" docs || echo "  (none — clean)"

echo
echo "==> Tree of new structure:"
find docs -type d | sort

echo
echo "Done. Review the diff with: git status && git diff --stat"
