-- Many-to-many Video <-> Category
CREATE TABLE IF NOT EXISTS "VideoCategory" (
    "videoId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "VideoCategory_pkey" PRIMARY KEY ("videoId","categoryId")
);

CREATE INDEX IF NOT EXISTS "VideoCategory_videoId_idx" ON "VideoCategory"("videoId");
CREATE INDEX IF NOT EXISTS "VideoCategory_categoryId_idx" ON "VideoCategory"("categoryId");

ALTER TABLE "VideoCategory" DROP CONSTRAINT IF EXISTS "VideoCategory_videoId_fkey";
ALTER TABLE "VideoCategory" ADD CONSTRAINT "VideoCategory_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoCategory" DROP CONSTRAINT IF EXISTS "VideoCategory_categoryId_fkey";
ALTER TABLE "VideoCategory" ADD CONSTRAINT "VideoCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy legacy single category into join table
INSERT INTO "VideoCategory" ("videoId", "categoryId")
SELECT "id", "categoryId" FROM "Video" WHERE "categoryId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop legacy column (run only after deploy; safe if column already removed)
ALTER TABLE "Video" DROP CONSTRAINT IF EXISTS "Video_categoryId_fkey";
DROP INDEX IF EXISTS "Video_categoryId_idx";
ALTER TABLE "Video" DROP COLUMN IF EXISTS "categoryId";
