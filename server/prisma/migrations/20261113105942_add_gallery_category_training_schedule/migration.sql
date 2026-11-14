-- CreateEnum
CREATE TYPE "GalleryCategory" AS ENUM ('MABAR', 'SPARING', 'UMUM');

-- AlterTable
ALTER TABLE "ClubSettings" ADD COLUMN     "trainingDays" VARCHAR(80) NOT NULL DEFAULT 'Jumat,Sabtu,Minggu',
ADD COLUMN     "trainingEnd" VARCHAR(5) NOT NULL DEFAULT '22:00',
ADD COLUMN     "trainingLocation" VARCHAR(160) NOT NULL DEFAULT 'GOR Tameklan',
ADD COLUMN     "trainingMapUrl" VARCHAR(500),
ADD COLUMN     "trainingStart" VARCHAR(5) NOT NULL DEFAULT '19:00';

-- AlterTable
ALTER TABLE "Gallery" ADD COLUMN     "category" "GalleryCategory" NOT NULL DEFAULT 'MABAR';

-- CreateIndex
CREATE INDEX "Gallery_category_isPublished_idx" ON "Gallery"("category", "isPublished");
