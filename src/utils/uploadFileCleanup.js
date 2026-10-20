const fs = require("fs/promises");
const path = require("path");

const uploadsDirectory = path.resolve(__dirname, "../../uploads");
const managedDirectories = new Set([
  "gemstones",
  "jewellery",
  "certificates",
  "banners",
]);

const getManagedUploadPath = (fileUrl) => {
  if (typeof fileUrl !== "string" || !fileUrl.trim()) return null;

  const pathname = fileUrl.trim().split(/[?#]/, 1)[0];
  if (!pathname.startsWith("/uploads/")) return null;

  const match = pathname.match(/^\/uploads\/([^/]+)\/([^/]+)$/);
  if (!match || !managedDirectories.has(match[1])) return null;

  const filePath = path.resolve(uploadsDirectory, match[1], match[2]);
  if (
    path.dirname(filePath) !== path.resolve(uploadsDirectory, match[1]) ||
    !filePath.startsWith(`${uploadsDirectory}${path.sep}`)
  ) {
    return null;
  }

  return filePath;
};

const removeUploadedFile = async (fileUrl) => {
  const filePath = getManagedUploadPath(fileUrl);
  if (!filePath) return false;

  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return true;
    console.error("Uploaded file cleanup failed:", error);
    return false;
  }
};

const removeUploadedFileObjects = async (files = []) => {
  const results = await Promise.allSettled(
    files.map(async (file) => {
      const filePath = path.resolve(file.path);
      if (!filePath.startsWith(`${uploadsDirectory}${path.sep}`)) {
        throw new Error("Refusing to remove a file outside the uploads directory.");
      }
      await fs.unlink(filePath);
    })
  );

  results
    .filter((result) => result.status === "rejected" && result.reason.code !== "ENOENT")
    .forEach((result) => console.error("Uploaded file cleanup failed:", result.reason));
};

module.exports = { removeUploadedFile, removeUploadedFileObjects };
