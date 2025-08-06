-- AlterTable
ALTER TABLE "bugs" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "searchVector" tsvector;

-- AlterTable
ALTER TABLE "docs" ADD COLUMN     "searchVector" tsvector;

-- AlterTable
ALTER TABLE "snippets" ADD COLUMN     "searchVector" tsvector;

-- CreateIndex
CREATE INDEX "bugs_searchVector_idx" ON "bugs" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "docs_searchVector_idx" ON "docs" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "snippets_searchVector_idx" ON "snippets" USING GIN ("searchVector");
