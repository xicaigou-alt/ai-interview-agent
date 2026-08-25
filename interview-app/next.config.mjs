/** @type {import('next').NextConfig} */
const nextConfig = {
  // 原生模块 / 带动态 require 的服务端依赖，排除出打包交给 Node 运行时加载
  serverExternalPackages: ["pdf-parse", "mammoth", "tesseract.js"],
};

export default nextConfig;
