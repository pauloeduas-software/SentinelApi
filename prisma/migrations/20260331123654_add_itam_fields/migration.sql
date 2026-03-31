-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "cpuModel" TEXT,
ADD COLUMN     "installedSoftware" JSONB,
ADD COLUMN     "localIp" TEXT,
ADD COLUMN     "macAddress" TEXT;
