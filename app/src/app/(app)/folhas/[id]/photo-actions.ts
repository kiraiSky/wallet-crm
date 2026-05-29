'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'
import { deleteUpload, saveUpload } from '@/lib/uploads'
import { logAudit } from '@/lib/audit'

const PHOTO_SLOTS = [
  'FRONT',
  'LEFT_SIDE',
  'RIGHT_SIDE',
  'REAR',
  'INTERIOR',
  'ODOMETER',
  'DAMAGE',
  'EXTRA',
] as const

export type WorkOrderPhotoSlot = (typeof PHOTO_SLOTS)[number]

export type WorkOrderPhotoState = {
  ok: boolean
  message?: string
}

const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO_SIZE = 8 * 1024 * 1024

function isPhotoSlot(value: string): value is WorkOrderPhotoSlot {
  return PHOTO_SLOTS.includes(value as WorkOrderPhotoSlot)
}

export async function saveWorkOrderPhoto(
  _prevState: WorkOrderPhotoState,
  formData: FormData
): Promise<WorkOrderPhotoState> {
  await getCurrentUser()

  const workOrderId = String(formData.get('workOrderId') ?? '')
  const slotRaw = String(formData.get('slot') ?? '')
  const note = String(formData.get('note') ?? '').trim()
  const file = formData.get('photo') as File | null

  if (!workOrderId) return { ok: false, message: 'Folha de obra invalida.' }
  if (!isPhotoSlot(slotRaw)) return { ok: false, message: 'Tipo de foto invalido.' }
  if (!file || file.size === 0) return { ok: false, message: 'Escolhe ou tira uma foto.' }
  if (file.size > MAX_PHOTO_SIZE) return { ok: false, message: 'Foto demasiado grande (max. 8 MB).' }
  if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
    return { ok: false, message: 'Formato nao suportado. Usa JPG, PNG ou WebP.' }
  }

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { id: true, numero: true },
  })
  if (!workOrder) return { ok: false, message: 'Folha de obra nao encontrada.' }

  let savedFile: Awaited<ReturnType<typeof saveUpload>> | null = null
  try {
    savedFile = await saveUpload(file)
    const photo = await prisma.workOrderPhoto.create({
      data: {
        workOrderId,
        slot: slotRaw,
        filename: savedFile.filename,
        storagePath: savedFile.storagePath,
        mimeType: savedFile.mimeType,
        size: savedFile.size,
        note: note || null,
      },
    })

    await logAudit({
      entityType: 'WORK_ORDER_PHOTO',
      entityId: photo.id,
      action: 'CREATE',
      summary: `Foto da folha #${workOrder.numero}`,
      after: { id: photo.id, workOrderId, slot: slotRaw, filename: photo.filename },
    })

    revalidatePath(`/folhas/${workOrderId}`)
    return { ok: true }
  } catch (e) {
    if (savedFile) await deleteUpload(savedFile.storagePath).catch(() => null)
    console.error(e)
    return { ok: false, message: 'Erro ao guardar foto.' }
  }
}

export async function deleteWorkOrderPhoto(photoId: string): Promise<WorkOrderPhotoState> {
  await getCurrentUser()

  const photo = await prisma.workOrderPhoto.findUnique({
    where: { id: photoId },
    include: { workOrder: { select: { id: true, numero: true } } },
  })
  if (!photo) return { ok: false, message: 'Foto nao encontrada.' }

  await prisma.workOrderPhoto.delete({ where: { id: photo.id } })
  await deleteUpload(photo.storagePath).catch(() => null)
  await logAudit({
    entityType: 'WORK_ORDER_PHOTO',
    entityId: photo.id,
    action: 'DELETE',
    summary: `Foto removida da folha #${photo.workOrder.numero}`,
    before: { id: photo.id, workOrderId: photo.workOrderId, slot: photo.slot, filename: photo.filename },
  })

  revalidatePath(`/folhas/${photo.workOrder.id}`)
  return { ok: true }
}
