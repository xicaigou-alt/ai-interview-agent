import Tesseract from "tesseract.js";
import path from "node:path";

// 单例 worker：首次调用时创建，之后复用（图片导入是串行的，无并发问题）
let workerPromise: Promise<Tesseract.Worker> | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker(["chi_sim", "eng"], 1, {
      // 本地语言包（tessdata/ 目录），避免运行时访问境外 CDN
      langPath: path.join(process.cwd(), "tessdata").replace(/\\/g, "/"),
      gzip: true,
      // 不写磁盘缓存；语言包直接载入 worker 内存，避免路径/权限问题
      cacheMethod: "none",
      logger: () => {},
    });
  }
  return workerPromise;
}

// 把 dataURL 图片里的文字 OCR 成文本（中文 + 英文）
export async function extractTextFromImage(imageDataUrl: string): Promise<string> {
  const comma = imageDataUrl.indexOf(",");
  if (comma < 0) throw new Error("无效的图片数据");
  const base64 = imageDataUrl.slice(comma + 1);
  const buf = Buffer.from(base64, "base64");
  if (buf.length === 0) throw new Error("图片内容为空");

  const worker = await getWorker();
  const { data } = await worker.recognize(buf);
  return (data.text ?? "").trim();
}
