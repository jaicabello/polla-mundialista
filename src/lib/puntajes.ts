export function calcularPuntos(
  goles1Real: number,
  goles2Real: number,
  goles1Pred: number,
  goles2Pred: number
): number {
  if (goles1Real === goles1Pred && goles2Real === goles2Pred) return 6

  const diffReal = goles1Real - goles2Real
  const diffPred = goles1Pred - goles2Pred

  const mismoGanador =
    (diffReal > 0 && diffPred > 0) ||
    (diffReal < 0 && diffPred < 0) ||
    (diffReal === 0 && diffPred === 0)

  if (mismoGanador) return 3

  return 0
}
