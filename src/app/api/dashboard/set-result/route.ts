import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { calcularPuntos, calcularPuntosPenales } from '@/lib/puntajes'

export async function POST(request: Request) {
  try {
    const { partidoId, goles1Real, goles2Real, penales1Real, penales2Real } = await request.json()

    if (!partidoId || goles1Real === undefined || goles2Real === undefined) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      )
    }

    if (typeof goles1Real !== 'number' || typeof goles2Real !== 'number') {
      return NextResponse.json(
        { error: 'Los goles deben ser números' },
        { status: 400 }
      )
    }

    const partidoRef = adminDb.collection('partidos').doc(partidoId)
    const partidoSnap = await partidoRef.get()

    if (!partidoSnap.exists) {
      return NextResponse.json(
        { error: 'Partido no encontrado' },
        { status: 404 }
      )
    }

    const partidoData = partidoSnap.data()!
    if (partidoData.estado === 'FT') {
      return NextResponse.json(
        { error: 'Este partido ya tiene un resultado registrado y no puede modificarse' },
        { status: 409 }
      )
    }

    const prediccionesSnap = await adminDb
      .collection('predicciones')
      .where('partidoId', '==', partidoId)
      .where('procesado', '==', false)
      .get()

    const batch = adminDb.batch()

    const updateData: Record<string, any> = {
      goles1Real,
      goles2Real,
      estado: 'FT',
    }
    if (penales1Real !== undefined && penales2Real !== undefined) {
      updateData.golesPenales1 = penales1Real
      updateData.golesPenales2 = penales2Real
    }
    batch.update(partidoRef, updateData)

    let puntosRepartidos = 0
    let usuariosActualizados = 0

    prediccionesSnap.forEach((predDoc) => {
      const pred = predDoc.data()
      const puntos = calcularPuntos(
        goles1Real,
        goles2Real,
        pred.goles1Pred,
        pred.goles2Pred
      )
      const penalesPuntos = calcularPuntosPenales(
        penales1Real, penales2Real,
        pred.penales1Pred, pred.penales2Pred,
      )
      const total = puntos + penalesPuntos

      batch.update(adminDb.collection('predicciones').doc(predDoc.id), {
        puntosGanados: puntos,
        penalesPuntos,
        procesado: true,
      })

      batch.update(adminDb.collection('usuarios').doc(pred.usuarioId), {
        puntosTotales: FieldValue.increment(total),
      })

      puntosRepartidos += total
      usuariosActualizados++
    })

    await batch.commit()

    return NextResponse.json({
      message: 'Resultado guardado correctamente',
      goles1Real,
      goles2Real,
      penales1Real: penales1Real ?? null,
      penales2Real: penales2Real ?? null,
      puntosRepartidos,
      usuariosActualizados,
    })
  } catch (error) {
    console.error('Error al guardar resultado:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
