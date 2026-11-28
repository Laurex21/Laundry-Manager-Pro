import { Client } from "@replit/object-storage";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";

export type CourseDocument = { filename: string; open: () => Readable };

export function configuredCourseDocument(): CourseDocument | undefined {
  if (process.env.NODE_ENV === "development" && !process.env.REPLIT_DEPLOYMENT) {
    const filename = "Manuel_de_Formation_XpressConsulting_V9.pdf";
    const file = path.resolve(".local", "consulting-materials", filename);
    if (existsSync(file)) return { filename, open: () => createReadStream(file) };
  }
  const bucketId = process.env.TRAINING_BUCKET_ID;
  const filename = process.env.CONSULTING_COURSE_DOCUMENT_NAME;
  if (!bucketId || !filename || !/^[\p{L}\p{N}][\p{L}\p{N} _.()-]{0,150}$/u.test(filename)) return;
  return {
    filename,
    open: () => new Client({ bucketId }).downloadAsStream("consulting-materials/" + filename),
  };
}
