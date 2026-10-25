export const d6 = () => 1 + Math.floor(Math.random() * 6);

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Probability that 2d6 totals at least n.
export function probAtLeast(n) {
  let c = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b >= n) c++;
  return c / 36;
}

export const pick = a => a[Math.floor(Math.random() * a.length)];
