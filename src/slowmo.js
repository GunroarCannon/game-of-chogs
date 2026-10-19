// ?slowmo=3 plays every animation, timer and effect three times slower: for recording demo footage on slow
// machines that capture few frames (speed the clip back up in the edit). Does nothing without the flag.
const k = +(new URLSearchParams(location.search).get('slowmo') || 1);
if (k > 1) {
  const st = window.setTimeout.bind(window), raf = window.requestAnimationFrame.bind(window), pn = performance.now.bind(performance);
  window.setTimeout = (f, ms = 0, ...a) => st(f, ms * k, ...a);
  performance.now = () => pn() / k;
  window.requestAnimationFrame = cb => raf(t => cb(t / k));
  const slow = () => { for (const a of document.getAnimations()) if (a.playbackRate !== 1 / k) a.playbackRate = 1 / k; raf(slow); };
  raf(slow);
}
