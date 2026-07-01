export function mgToIu(mg: number, mgPerIu: number): number {
  return mgPerIu > 0 ? mg / mgPerIu : 0;
}
export function iuToMg(iu: number, mgPerIu: number): number {
  return iu * mgPerIu;
}
