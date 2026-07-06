export function calcularPuntos(
  goles1Real: number,
  goles2Real: number,
  goles1Pred: number,
  goles2Pred: number,
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

export function calcularPuntosPenales(
  penales1Real: number | null,
  penales2Real: number | null,
  penales1Pred: number | null,
  penales2Pred: number | null,
): number {
  if (!penales1Pred || !penales2Pred) return 0
  if (!penales1Real || !penales2Real) return 0
  const winnerReal = penales1Real > penales2Real ? 1 : 2
  const winnerPred = penales1Pred > penales2Pred ? 1 : 2
  return winnerReal === winnerPred ? 3 : 0
}
