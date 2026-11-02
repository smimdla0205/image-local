// 이미지 파일 저장소(로컬 디스크). 다음 단계에서 S3 로 바꿀 때 이 모듈만 바꾼다
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// images: PNG 원본(다운로드), thumbs: 512px WebP(목록), previews: 원본 크기 WebP(화면)
export type StorageKind = "images" | "thumbs" | "previews";

// 상대 경로(./storage-test)는 서버를 띄운 폴더 기준이다.
// turbopackIgnore: 저장소는 실행 중에 쌓이는 데이터라 빌드 파일 추적(배포 산출물)에 넣지 않는다
export const STORAGE_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR || path.join(process.cwd(), "storage"));

export const FILE_NAME_RE = /^[a-z0-9]+\.(png|webp)$/;
const EXTENSION: Record<StorageKind, string> = { images: "png", thumbs: "webp", previews: "webp" };
const KEY_RE = /^(images|thumbs|previews)\/[a-z0-9]+\.(png|webp)$/;

export function storageKey(kind: StorageKind, id: string): string {
  return `${kind}/${id}.${EXTENSION[kind]}`;
}

export function isStorageKind(x: string): x is StorageKind {
  return Object.hasOwn(EXTENSION, x);
}

// 요청 경로의 kind·파일 이름을 저장소 안 경로로 바꾼다. 형식이 다르면(경로 조작 포함) null
export function resolveStoragePath(kind: StorageKind, file: string): string | null {
  if (!FILE_NAME_RE.test(file) || !file.endsWith(`.${EXTENSION[kind]}`)) return null;
  return path.join(/*turbopackIgnore: true*/ STORAGE_DIR, kind, file);
}

function keyPath(key: string): string {
  if (!KEY_RE.test(key)) throw new Error("잘못된 저장소 키");
  return path.join(/*turbopackIgnore: true*/ STORAGE_DIR, key);
}

// 임시 파일에 쓴 뒤 이름을 바꿔, 읽는 쪽이 반쯤 쓴 파일을 보지 않게 한다
export async function putFile(key: string, data: Uint8Array): Promise<void> {
  const target = keyPath(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, target);
  } catch (e) {
    await fs.rm(tmp, { force: true });
    throw e;
  }
}

export async function readFile(key: string): Promise<Uint8Array<ArrayBuffer>> {
  // fs.readFile 의 Buffer 는 일반 ArrayBuffer 위에 있다
  return (await fs.readFile(/*turbopackIgnore: true*/ keyPath(key))) as Uint8Array<ArrayBuffer>;
}

export async function deleteFile(key: string): Promise<void> {
  await fs.rm(keyPath(key), { force: true });
}

// 이미지 한 장의 원본(PNG)·썸네일·화면용 미리보기를 쓴다(원본 먼저)
export async function putImageFiles(id: string, png: Uint8Array, thumb: Uint8Array, preview: Uint8Array): Promise<void> {
  await putFile(storageKey("images", id), png);
  await putFile(storageKey("thumbs", id), thumb);
  await putFile(storageKey("previews", id), preview);
}

// 세 파일을 함께 지운다. 하나가 실패해도 나머지는 지우고, 오류는 던지지 않는다
export async function deleteImageFiles(id: string): Promise<void> {
  await Promise.allSettled([deleteFile(storageKey("images", id)), deleteFile(storageKey("thumbs", id)), deleteFile(storageKey("previews", id))]);
}
