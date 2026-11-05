#!/usr/bin/env bash
# Redeploy AfterSight to the linked Vercel project auggernauts-projects/aftersight (production: https://aftersight-zeta.vercel.app)
# Usage: bash tools/deploy/aftersight-redeploy.sh [branch]   (default branch: main)
#        ANALYTICS=1 bash tools/deploy/aftersight-redeploy.sh   adds Vercel Web Analytics (anonymous, no cookies). Turn
#        Web Analytics on in the Vercel project first, or the script it loads is missing.
# Deploys need Augustin's explicit OK. Needs a Vercel login and a deploy folder linked to the project
# (DEPLOY_DIR/.vercel, never committed). It deploys by itself: run it once, with no extra `vercel deploy` after.
# REPO and DEPLOY_DIR default to the paths on the agent box.
set -euo pipefail
B=${1:-main}; D=${DEPLOY_DIR:-/workspace/aftersight}; REPO=${REPO:-/workspace/Afterlight}
cd "$REPO" && git checkout -q "$B" && git pull -q --ff-only && npm run build
find $D -mindepth 1 -maxdepth 1 ! -name .vercel ! -name .vercelignore -exec rm -rf {} +
cp -r dist/. $D/ && cp MicropolisPublicNameLicense.md $D/
cd $D
printf '{\n  "headers": [\n    { "source": "/(.*)", "headers": [ { "key": "X-Robots-Tag", "value": "noindex, nofollow" } ] }\n  ]\n}\n' > vercel.json
for f in *.html; do grep -q 'name="robots"' $f || sed -i 's|<head>|<head><meta name="robots" content="noindex, nofollow">|' $f; done
if [ "${ANALYTICS:-0}" = "1" ]; then
  sed -i 's#</head>#<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script><script defer src="/_vercel/insights/script.js"></script></head>#' index.html
fi
npx -y vercel@latest deploy --prod --yes
