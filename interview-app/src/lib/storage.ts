import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// 保存上传文件到本地 uploads/，返回可访问的相对路径
export async function saveUpload(file: File): Promise<string> {
  const dir = path.join(process.cwd(), "uploads");
  await fs.mkdir(dir, { recursive: true });

  const ext = path.extname(file.name) || ".bin";
  const name = `${randomUUID()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, name), buf);

  return `/uploads/${name}`;
}
