// Progress photos: images in private Supabase Storage (folder = your user
// id), one progress_photos row per photo with its date and note.
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { track } from '../lib/saveStatus'
import { toISO } from '../lib/dates'
import { uuid } from '../workout/lib'

export const BUCKET = 'progress-photos'
const MAX_SIDE = 1600

export const fetchPhotos = () =>
  fetchAll(() =>
    supabase.from('progress_photos').select('*').order('taken_on', { ascending: false }).order('created_at', { ascending: false }),
  )

// Temporary private links (valid 1 hour) for showing images.
export async function signedUrls(paths) {
  if (!paths.length) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  if (error) throw error
  return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
}

// Shrinks the photo (keeps orientation) so uploads are quick on a phone.
async function compress(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error("Couldn't read that image."))
      i.src = url
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  } finally {
    URL.revokeObjectURL(url)
  }
}

// The day the photo was taken (file date), as a sensible default.
export const fileDate = (file) => toISO(new Date(file.lastModified || Date.now()))

export async function uploadPhoto(file, takenOn, note) {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('Not signed in.')
  const blob = await compress(file)
  const path = `${userId}/${uuid()}.jpg`
  const up = await track(supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' }))
  if (up.error) throw new Error(`Upload failed — ${up.error.message}`)
  const { error } = await track(supabase.from('progress_photos').insert({ taken_on: takenOn, storage_path: path, note }))
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(`Not saved — ${error.message}`)
  }
}

export async function deletePhoto(photo) {
  const { error } = await track(supabase.from('progress_photos').delete().eq('id', photo.id))
  if (error) throw new Error(error.message)
  await supabase.storage.from(BUCKET).remove([photo.storage_path])
}
