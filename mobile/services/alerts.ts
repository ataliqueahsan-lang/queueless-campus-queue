export interface InAppAlert { id: string; title: string; body: string }
const listeners = new Set<(a: InAppAlert) => void>();
export const emitAlert = (a: InAppAlert) => listeners.forEach((l) => l(a));
export const onAlert = (l: (a: InAppAlert) => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
