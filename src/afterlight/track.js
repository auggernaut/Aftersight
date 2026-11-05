/* AfterSight is a modified version of micropolisJS, released under the GNU GPL v3 with additional terms.
 * See LICENSE and COPYING.
 *
 * Anonymous game milestones for Vercel Web Analytics (no cookies, no personal data). The live site's deploy adds the
 * analytics script only when it is deployed with ANALYTICS=1 (tools/deploy/aftersight-redeploy.sh); anywhere else
 * window.va doesn't exist and this does nothing. Custom events need a Vercel plan that records them; page views don't.
 */
export function track(name, data) {
  try { if (typeof window !== 'undefined' && typeof window.va === 'function') window.va('event', {name: name, data: data || {}}); } catch (e) { /* never break the game */ }
}
