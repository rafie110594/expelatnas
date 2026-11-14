-- AlterTable
ALTER TABLE "MemberProfile" ADD COLUMN     "gender" VARCHAR(20);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alias" VARCHAR(120);

-- Rentang rank baru: D 0-19, C 20-39, B 40-59, B+ 60-79, A 80+
UPDATE "RankSetting" SET "minPoints" = 80, "maxPoints" = NULL, "order" = 5, "isActive" = true WHERE "name" = 'A';
UPDATE "RankSetting" SET "minPoints" = 0,  "maxPoints" = 19,   "order" = 1, "isActive" = true WHERE "name" = 'D';
UPDATE "RankSetting" SET "minPoints" = 20, "maxPoints" = 39,   "order" = 2, "isActive" = true WHERE "name" = 'C';
UPDATE "RankSetting" SET "minPoints" = 40, "maxPoints" = 59,   "order" = 3, "isActive" = true WHERE "name" = 'B';
INSERT INTO "RankSetting" ("id", "name", "minPoints", "maxPoints", "order", "isActive", "createdAt", "updatedAt")
VALUES ('rank-b-plus', 'B+', 60, 79, 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET
  "minPoints" = EXCLUDED."minPoints",
  "maxPoints" = EXCLUDED."maxPoints",
  "order" = EXCLUDED."order",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
