import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal AI Interview Agent",
  description: "个人专属 AI 模拟面试",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <Link href="/" className="font-semibold">
              AI 模拟面试
            </Link>
            <Link href="/interview/new" className="text-sm text-slate-600 hover:text-slate-900">
              新建面试
            </Link>
            <Link href="/knowledge" className="text-sm text-slate-600 hover:text-slate-900">
              知识库
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
