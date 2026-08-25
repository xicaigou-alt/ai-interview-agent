declare module "mammoth" {
  export interface MammothResult {
    value: string;
    messages: unknown[];
  }

  interface Mammoth {
    extractRawText(input: { buffer: Buffer } | { path: string }): Promise<MammothResult>;
  }

  const mammoth: Mammoth;
  export default mammoth;
}
