// ============================================================
// Service event — daftar publik (PUBLISHED) / admin (semua),
// CRUD + banner opsional + audit
// ============================================================
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { writeAudit } = require('../utils/audit');
const { saveImage, removeImage } = require('../lib/storage');

function toItem(e) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    imageUrl: e.imageUrl,
    startAt: e.startAt,
    endAt: e.endAt,
    status: e.status,
    createdBy: e.createdBy?.fullName || null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

const INCLUDE = { createdBy: { select: { fullName: true } } };

// ---------- Daftar ----------

async function listPublic(query) {
  const { page, limit, search, time } = query;
  const now = new Date();
  const where = {
    status: 'PUBLISHED',
    ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    ...(time === 'upcoming' ? { startAt: { gte: now } } : {}),
    ...(time === 'past' ? { startAt: { lt: now } } : {}),
  };
  const orderBy = time === 'past' ? { startAt: 'desc' } : { startAt: 'asc' };

  const [rows, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: INCLUDE,
    }),
    prisma.event.count({ where }),
  ]);
  return {
    items: rows.map(toItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function listAdmin(query) {
  const { page, limit, search, status } = query;
  const where = {
    ...(status ? { status } : {}),
    ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: INCLUDE,
    }),
    prisma.event.count({ where }),
  ]);
  return {
    items: rows.map(toItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/** Detail — event non-published hanya terlihat oleh admin */
async function detail(id, viewer) {
  const item = await prisma.event.findUnique({ where: { id }, include: INCLUDE });
  if (!item) throw ApiError.notFound('Event tidak ditemukan');
  if (item.status !== 'PUBLISHED' && viewer?.role !== 'ADMIN') {
    throw ApiError.notFound('Event tidak ditemukan');
  }
  return toItem(item);
}

// ---------- Create ----------

async function create(data, file, actor) {
  // status: field 'published' (multipart) menimpa 'status' (JSON)
  const status =
    data.published !== undefined
      ? data.published
        ? 'PUBLISHED'
        : 'DRAFT'
      : data.status || 'DRAFT';

  let imageUrl = data.imageUrl || null;
  let saved = null;
  if (file) {
    saved = await saveImage(file.buffer, file.mimetype);
    imageUrl = saved.url;
  }

  try {
    const item = await prisma.$transaction(
      async (tx) => {
        const created = await tx.event.create({
          data: {
            title: data.title,
            description: data.description || null,
            location: data.location || null,
            imageUrl,
            startAt: data.startAt,
            endAt: data.endAt || null,
            status,
            createdById: actor.id,
          },
          include: INCLUDE,
        });
        await writeAudit(tx, {
          adminId: actor.id,
          action: 'EVENT_CREATE',
          entity: 'Event',
          entityId: created.id,
          after: { title: created.title, status: created.status, startAt: created.startAt },
          note: 'Event dibuat',
        });
        return created;
      },
      { timeout: 10000 }
    );
    return toItem(item);
  } catch (err) {
    if (saved) await removeImage(saved.publicId);
    throw err;
  }
}

// ---------- Update ----------

async function update(id, data, file, actor) {
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Event tidak ditemukan');

  const patch = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description || null;
  if (data.location !== undefined) patch.location = data.location || null;
  if (data.status !== undefined) patch.status = data.status;
  if (data.startAt !== undefined) patch.startAt = data.startAt;
  if (data.endAt !== undefined) patch.endAt = data.endAt; // null = kosongkan
  if (data.clearImage === 'true') patch.imageUrl = null;
  if (data.imageUrl !== undefined && !file && data.clearImage !== 'true') {
    patch.imageUrl = data.imageUrl || null;
  }

  // Validasi silang waktu (gabungan data lama + perubahan)
  const mergedStart = patch.startAt !== undefined ? patch.startAt : existing.startAt;
  const mergedEnd = patch.endAt !== undefined ? patch.endAt : existing.endAt;
  if (mergedEnd && mergedStart && mergedEnd < mergedStart) {
    throw ApiError.badRequest('Waktu selesai tidak boleh sebelum waktu mulai');
  }

  let saved = null;
  if (file) {
    // Event tidak punya kolom publicId — identitas file lama
    // dibaca dari URL (/uploads/...) saat penghapusan.
    saved = await saveImage(file.buffer, file.mimetype);
    patch.imageUrl = saved.url;
  }

  // Simpan publicId baru bila banner diganti (model Event menyimpan imageUrl;
  // publicId file lama tidak ada kolomnya → bersihkan berdasarkan deteksi URL)
  try {
    const item = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.event.update({
          where: { id },
          data: patch,
          include: INCLUDE,
        });
        await writeAudit(tx, {
          adminId: actor.id,
          action: 'EVENT_UPDATE',
          entity: 'Event',
          entityId: id,
          before: { title: existing.title, status: existing.status, imageUrl: existing.imageUrl, startAt: existing.startAt },
          after: { title: updated.title, status: updated.status, imageUrl: updated.imageUrl, startAt: updated.startAt },
          note: 'Event diperbarui',
        });
        return updated;
      },
      { timeout: 10000 }
    );

    if (saved && existing.imageUrl) await cleanupOldBanner(existing.imageUrl);
    return toItem(item);
  } catch (err) {
    if (saved) await removeImage(saved.publicId);
    throw err;
  }
}

/** Hapus file lokal lama bila URL-nya milik driver lokal */
async function cleanupOldBanner(imageUrl) {
  if (!imageUrl || !imageUrl.includes('/uploads/')) return; // cloudinary/eksternal: lepas
  const name = imageUrl.split('/uploads/')[1];
  if (name) await removeImage(name);
}

// ---------- Delete ----------

async function remove(id, actor) {
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Event tidak ditemukan');

  await prisma.$transaction(
    async (tx) => {
      await tx.event.delete({ where: { id } });
      await writeAudit(tx, {
        adminId: actor.id,
        action: 'EVENT_DELETE',
        entity: 'Event',
        entityId: id,
        before: { title: existing.title, status: existing.status },
        note: 'Event dihapus',
      });
    },
    { timeout: 10000 }
  );

  await cleanupOldBanner(existing.imageUrl);
  return { id, deleted: true };
}

module.exports = { listPublic, listAdmin, detail, create, update, remove };
