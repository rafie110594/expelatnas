// ============================================================
// Penyimpanan gambar (abstraksi "Cloudinary-type")
//
// Driver:
//   local       — tulis ke UPLOAD_DIR, disajikan statis /uploads,
//                 imageUrl dibangun dari PUBLIC_BASE_URL
//   cloudinary  — aktif bila STORAGE_DRIVER=cloudinary dan
//                 CLOUDINARY_URL terisi (SDK membaca env itu sendiri)
//   vercel-blob — aktif bila STORAGE_DRIVER=vercel-blob dan
//                 BLOB_READ_WRITE_TOKEN terisi (Vercel Blob)
// ============================================================
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// ---------- Driver lokal ----------

async function saveLocal(buffer, ext) {
  await fs.mkdir(env.uploads.dir, { recursive: true });
  // Nama file dihasilkan server (bukan dari pengguna) → aman dari path traversal
  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(env.uploads.dir, name), buffer);
  return {
    url: `${env.uploads.publicBaseUrl}/uploads/${name}`,
    publicId: name,
    driver: 'local',
  };
}

async function removeLocal(publicId) {
  // publicId lokal tidak mengandung '/' (lihat deteksi di removeImage)
  try {
    await fs.unlink(path.join(env.uploads.dir, path.basename(publicId)));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[storage] gagal menghapus file lama:', publicId, err.message);
    }
  }
}

// ---------- Driver Cloudinary ----------

async function saveCloudinary(buffer) {
  if (!process.env.CLOUDINARY_URL) {
    throw ApiError.internal(
      'STORAGE_DRIVER=cloudinary tetapi CLOUDINARY_URL belum diisi di .env'
    );
  }
  const { v2: cloudinary } = require('cloudinary');
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'pb-expelatnas', resource_type: 'image' },
      (err, res) => {
        if (err) {
          console.error('[storage] cloudinary:', err.message);
          return reject(ApiError.internal('Gagal mengunggah gambar ke Cloudinary'));
        }
        resolve({ url: res.secure_url, publicId: res.public_id, driver: 'cloudinary' });
      }
    );
    stream.end(buffer);
  });
}

async function removeCloudinary(publicId) {
  try {
    const { v2: cloudinary } = require('cloudinary');
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('[storage] gagal menghapus gambar cloudinary:', publicId, err.message);
  }
}

// ---------- Driver Vercel Blob ----------

async function saveVercelBlob(buffer, ext, mimetype) {
  const hasCredentials = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID;
  if (!hasCredentials) {
    throw ApiError.internal(
      'STORAGE_DRIVER=vercel-blob tetapi kredensial Vercel Blob belum tersedia'
    );
  }
  const { put } = require('@vercel/blob');
  const name = `pb-expelatnas/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const blob = await put(name, buffer, {
    access: 'public',
    contentType: mimetype,
    addRandomSuffix: false,
  });
  return { url: blob.url, publicId: blob.url, driver: 'vercel-blob' };
}

async function removeVercelBlob(url) {
  try {
    const { del } = require('@vercel/blob');
    await del(url);
  } catch (err) {
    console.warn('[storage] gagal menghapus gambar vercel blob:', url, err.message);
  }
}

// ---------- API publik ----------

/** Simpan buffer gambar, kembalikan { url, publicId, driver } */
async function saveImage(buffer, mimetype) {
  const ext = MIME_EXT[mimetype];
  if (!ext) throw ApiError.badRequest('Tipe gambar tidak didukung (JPEG/PNG/WEBP/GIF)');
  if (env.uploads.driver === 'cloudinary') return saveCloudinary(buffer);
  if (env.uploads.driver === 'vercel-blob') return saveVercelBlob(buffer, ext, mimetype);
  return saveLocal(buffer, ext);
}

/**
 * Hapus gambar berdasar publicId — driver ditebak dari bentuk id:
 * URL absolut = Vercel Blob, id berisi '/' = Cloudinary, sisanya lokal.
 * Kegagalan penghapusan hanya warning (tidak menggagalkan request).
 */
async function removeImage(publicId) {
  if (!publicId) return;
  if (/^https?:\/\//i.test(publicId)) return removeVercelBlob(publicId);
  if (publicId.includes('/')) return removeCloudinary(publicId);
  return removeLocal(publicId);
}

module.exports = { saveImage, removeImage, MIME_EXT };
