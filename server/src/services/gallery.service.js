// ============================================================
// Service galeri — daftar publik/admin, CRUD + simpan gambar
// ============================================================
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { writeAudit } = require('../utils/audit');
const { saveImage, removeImage } = require('../lib/storage');

function toItem(g) {
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    category: g.category,
    imageUrl: g.imageUrl,
    isPublished: g.isPublished,
    uploadedBy: g.uploadedBy?.fullName || null,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

const INCLUDE = { uploadedBy: { select: { fullName: true } } };

// ---------- Daftar ----------

async function listPublic(query) {
  const { page, limit, search, category } = query;
  const where = {
    isPublished: true,
    ...(category ? { category } : {}),
    ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.gallery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: INCLUDE,
    }),
    prisma.gallery.count({ where }),
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
  const { page, limit, search, published, category } = query;
  const where = {
    ...(category ? { category } : {}),
    ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    ...(published === 'true' ? { isPublished: true } : {}),
    ...(published === 'false' ? { isPublished: false } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.gallery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: INCLUDE,
    }),
    prisma.gallery.count({ where }),
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

/** Detail — item belum terbit hanya terlihat oleh admin */
async function detail(id, viewer) {
  const item = await prisma.gallery.findUnique({ where: { id }, include: INCLUDE });
  if (!item) throw ApiError.notFound('Item galeri tidak ditemukan');
  if (!item.isPublished && viewer?.role !== 'ADMIN') {
    throw ApiError.notFound('Item galeri tidak ditemukan');
  }
  return toItem(item);
}

// ---------- Create ----------

async function create(data, file, actor) {
  if (!file) throw ApiError.badRequest('Gambar wajib di-upload');

  const saved = await saveImage(file.buffer, file.mimetype);
  try {
    const item = await prisma.$transaction(
      async (tx) => {
        const created = await tx.gallery.create({
          data: {
            title: data.title,
            description: data.description || null,
            category: data.category || 'MABAR',
            imageUrl: saved.url,
            publicId: saved.publicId,
            isPublished: data.isPublished !== false,
            uploadedById: actor.id,
          },
          include: INCLUDE,
        });
        await writeAudit(tx, {
          adminId: actor.id,
          action: 'GALLERY_CREATE',
          entity: 'Gallery',
          entityId: created.id,
          after: { title: created.title, category: created.category, imageUrl: created.imageUrl, isPublished: created.isPublished },
          note: 'Item galeri ditambahkan',
        });
        return created;
      },
      { timeout: 10000 }
    );
    return toItem(item);
  } catch (err) {
    await removeImage(saved.publicId); // bersihkan file bila transaksi gagal
    throw err;
  }
}

// ---------- Update ----------

async function update(id, data, file, actor) {
  const existing = await prisma.gallery.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Item galeri tidak ditemukan');

  const patch = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description || null;
  if (data.category !== undefined) patch.category = data.category;
  if (data.isPublished !== undefined) patch.isPublished = data.isPublished;

  let saved = null;
  if (file) {
    saved = await saveImage(file.buffer, file.mimetype);
    patch.imageUrl = saved.url;
    patch.publicId = saved.publicId;
  }

  try {
    const item = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.gallery.update({
          where: { id },
          data: patch,
          include: INCLUDE,
        });
        await writeAudit(tx, {
          adminId: actor.id,
          action: 'GALLERY_UPDATE',
          entity: 'Gallery',
          entityId: id,
          before: { title: existing.title, category: existing.category, isPublished: existing.isPublished, imageUrl: existing.imageUrl },
          after: { title: updated.title, category: updated.category, isPublished: updated.isPublished, imageUrl: updated.imageUrl },
          note: 'Item galeri diperbarui',
        });
        return updated;
      },
      { timeout: 10000 }
    );

    // File lama dihapus SETELAH transaksi sukses
    if (saved && existing.publicId) await removeImage(existing.publicId);
    return toItem(item);
  } catch (err) {
    if (saved) await removeImage(saved.publicId);
    throw err;
  }
}

// ---------- Delete ----------

async function remove(id, actor) {
  const existing = await prisma.gallery.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Item galeri tidak ditemukan');

  await prisma.$transaction(
    async (tx) => {
      await tx.gallery.delete({ where: { id } });
      await writeAudit(tx, {
        adminId: actor.id,
        action: 'GALLERY_DELETE',
        entity: 'Gallery',
        entityId: id,
        before: { title: existing.title, imageUrl: existing.imageUrl },
        note: 'Item galeri dihapus',
      });
    },
    { timeout: 10000 }
  );

  await removeImage(existing.publicId);
  return { id, deleted: true };
}

module.exports = { listPublic, listAdmin, detail, create, update, remove };
