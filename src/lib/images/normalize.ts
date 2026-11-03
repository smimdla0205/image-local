// 이미지 정규화(sharp): EXIF 회전 보정 → 1MP·16 배수 크기 → PNG. 단위 테스트가 불러오므로 상대 경로 import 만 쓴다
import sharp from "sharp";

import { fitToMegapixel } from "../gpu/sizes";

export const THUMB_SIZE = 512;
// 디코드 전에 거르는 픽셀 수 상한(압축 폭탄 방지). 업로드는 20MB 상한이라 실제 사진은 이 안에 든다
const MAX_INPUT_PIXELS = 100_000_000;

export type NormalizedImage = { png: Uint8Array; width: number; height: number; hasAlpha: boolean };

// EXIF orientation 5~8 은 가로세로가 바뀐다
const SWAPS_AXES = new Set([5, 6, 7, 8]);

export async function readImageSize(input: Uint8Array): Promise<{ width: number; height: number }> {
  const meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  if (!meta.width || !meta.height) throw new Error("이미지 크기를 읽을 수 없어요");
  const swap = SWAPS_AXES.has(meta.orientation ?? 1);
  return { width: swap ? meta.height : meta.width, height: swap ? meta.width : meta.height };
}

export async function inspectPng(png: Uint8Array): Promise<{ width: number; height: number; hasAlpha: boolean }> {
  const meta = await sharp(png).metadata();
  if (!meta.width || !meta.height) throw new Error("이미지 크기를 읽을 수 없어요");
  // alpha 채널이 있어도 전부 불투명이면 투명 이미지로 보지 않는다
  const hasAlpha = meta.hasAlpha ? !(await sharp(png).stats()).isOpaque : false;
  return { width: meta.width, height: meta.height, hasAlpha };
}

export async function normalizeImage(input: Uint8Array): Promise<NormalizedImage> {
  const oriented = await readImageSize(input);
  const target = fitToMegapixel(oriented.width, oriented.height);
  const png = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize(target.width, target.height, { fit: "fill" })
    .png()
    .toBuffer();
  const { hasAlpha } = await inspectPng(png);
  return { png, width: target.width, height: target.height, hasAlpha };
}

export async function makeThumb(png: Uint8Array): Promise<Uint8Array> {
  return sharp(png).resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}

// 화면에 보이는 이미지(결과·비교·뷰어): 원본과 같은 크기의 WebP, 투명도 유지. 1MP 생성 이미지가 PNG 1.1MB → 약 80KB. 다운로드는 PNG 원본
const PREVIEW_QUALITY = 85;

export async function makePreview(png: Uint8Array): Promise<Uint8Array> {
  return sharp(png).webp({ quality: PREVIEW_QUALITY }).toBuffer();
}

// 저장할 때 함께 만드는 썸네일·미리보기(서로 기다리지 않게 함께 만든다)
export async function makeVariants(png: Uint8Array): Promise<{ thumb: Uint8Array; preview: Uint8Array }> {
  const [thumb, preview] = await Promise.all([makeThumb(png), makePreview(png)]);
  return { thumb, preview };
}
