// 스트림을 상한까지만 읽는다(넘으면 읽기를 멈추고 null). 업로드 본문과 워커 결과 다운로드가 같이 쓴다
// 단위 테스트가 불러오는 모듈(gpu/client)이 쓰므로 import 가 없다
export async function readStreamLimited(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
