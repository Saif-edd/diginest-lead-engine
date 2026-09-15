import fs from "node:fs/promises";
import { del, get, put } from "@vercel/blob";

export async function uploadAuditScreenshot(path: string, leadId: string, timestamp: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  const file = await fs.readFile(path);
  return put(`audit-screenshots/${leadId}/${timestamp.replace(/[:.]/g, "-")}.png`, file, {
    access: "private",
    contentType: "image/png",
    addRandomSuffix: false,
  });
}

export async function readAuditScreenshot(url: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  return get(url, { access: "private" });
}

export { del as deleteScreenshot };
