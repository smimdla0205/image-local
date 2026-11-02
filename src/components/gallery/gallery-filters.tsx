"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ModelId, MODELS } from "@/lib/gpu/models";

export type GalleryFilter = { q: string; model: ModelId | "" };

const ALL = "all";
const MODEL_ITEMS: Record<string, string> = { [ALL]: "전체", ...Object.fromEntries(MODELS.map((m) => [m.id, m.shortName])) };
const SEARCH_DEBOUNCE_MS = 300;

// 프롬프트 검색(입력이 멈추면 300ms 뒤 반영)과 모델 필터
export function GalleryFilters({ q, model, onChange }: GalleryFilter & { onChange: (next: GalleryFilter) => void }) {
  const searchId = useId();
  const [text, setText] = useState(q);
  // 뒤로 가기처럼 주소가 바깥에서 바뀌면 입력값을 맞춘다(렌더 중 조정 — 입력하던 중이면 그대로 둔다)
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    if (text.trim() !== q) setText(q);
  }

  // 입력값을 주소(URL)와 맞추는 일이라 타이머를 Effect 에서 돌린다(정리 함수로 이전 타이머를 지운다)
  useEffect(() => {
    if (text.trim() === q) return;
    const timer = setTimeout(() => onChange({ q: text.trim(), model }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, q, model, onChange]);

  return (
    <div role="search" className="flex flex-wrap items-center gap-2">
      <label
        htmlFor={searchId}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-3 focus-within:shadow-focus-ring max-md:h-11 sm:max-w-80"
      >
        <SearchIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="sr-only">프롬프트로 찾기</span>
        <input
          id={searchId}
          type="search"
          value={text}
          placeholder="프롬프트로 찾기"
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-label outline-none placeholder:text-muted-foreground"
        />
      </label>
      <Select items={MODEL_ITEMS} value={model || ALL} onValueChange={(v) => onChange({ q: text.trim(), model: v === ALL || v === null ? "" : (v as ModelId) })}>
        <SelectTrigger aria-label="모델" className="min-w-32 max-md:h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(MODEL_ITEMS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
