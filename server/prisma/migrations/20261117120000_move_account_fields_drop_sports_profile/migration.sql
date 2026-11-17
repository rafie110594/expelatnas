-- Pindahkan data akun dari MemberProfile ke User
ALTER TABLE "User" ADD COLUMN "gender" VARCHAR(20),
ADD COLUMN "birthDate" TIMESTAMP(3);

UPDATE "User" AS u
SET "gender" = p."gender",
    "birthDate" = p."birthDate"
FROM "MemberProfile" AS p
WHERE p."userId" = u."id";

-- Hapus profil olahraga yang tidak lagi dipakai
ALTER TABLE "MemberProfile"
  DROP COLUMN "gender",
  DROP COLUMN "birthDate",
  DROP COLUMN "genderCategory",
  DROP COLUMN "doublesRole",
  DROP COLUMN "dominantHand",
  DROP COLUMN "background",
  DROP COLUMN "racket";

-- Index untuk daftar/count pertandingan terbaru
CREATE INDEX "Match_status_createdAt_idx" ON "Match"("status", "createdAt");
