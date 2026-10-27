/* Aftersight money formatting for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 *
 * The engine counts in game dollars. In Festus one game dollar stands for $1,000 (a Festus-sized town has about
 * $20M in the bank and an $11M general fund), so everything the player reads there is shown in real dollars:
 * $200k a year, a $1.5M lab, $20M in the bank. Other scenarios keep the engine's plain dollars.
 */

export const DOLLARS = 1000;      // real dollars per game dollar (Festus)

var real = false;
export function setRealDollars(on) { real = !!on; }
export function realDollars() { return real; }

var commas = function(n) { return ('' + Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
var short = function(v, unit) { return (v < 10 ? v.toFixed(1).replace(/\.0$/, '') : '' + Math.round(v)) + unit; };

// An amount already in real dollars: $820, $14,300, $2.4M
export function usd(n) {
  var v = Math.abs(n), sign = n < 0 ? '−' : '';
  if (v >= 1e9) return sign + '$' + short(v / 1e9, 'B');
  if (v >= 1e6) return sign + '$' + short(v / 1e6, 'M');
  return sign + '$' + commas(v);
}

// An amount in game dollars: real dollars in Festus ($200k, $1.5M, $20M), plain dollars elsewhere
export function money(n) {
  if (!real) return (n < 0 ? '−' : '') + '$' + commas(Math.abs(n));
  var v = Math.abs(n) * DOLLARS, sign = n < 0 ? '−' : '';
  if (v >= 1e9) return sign + '$' + short(v / 1e9, 'B');
  if (v >= 1e6) return sign + '$' + short(v / 1e6, 'M');
  if (v >= 1e3) return sign + '$' + Math.round(v / 1e3) + 'k';
  return sign + '$' + Math.round(v);
}

// Rewrite "$1,500"-style game amounts inside a sentence (tool tips written for the engine's dollars)
export function moneyText(text) {
  if (!real || !text) return text;
  return text.replace(/\$([\d,]+)/g, function(all, num) { return money(+num.replace(/,/g, '')); });
}
