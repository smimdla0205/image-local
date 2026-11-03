// 여러 컴포넌트가 같이 쓰는 클래스 상수. 컴포넌트 파일에서 export 하면 그 컴포넌트까지 함께 번들에 실리므로 여기 둔다

// 이미지 위에 떠 있는 아이콘 버튼(크게 보기·고치기·다운로드·삭제)
export const FLOAT_CLASS =
  "inline-grid size-8 place-items-center rounded-md bg-overlay text-overlay-foreground transition-colors outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:shadow-focus-ring max-md:size-11";

export const ICON_BUTTON_CLASS =
  "inline-grid size-8 shrink-0 place-items-center rounded-md text-foreground transition-colors outline-none hover:bg-secondary focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent aria-expanded:bg-secondary max-md:size-11";

// 지우기 버튼 글자색. 흰(카드) 배경 위 빨강이라 대비 4.5:1 을 넘는다(옅은 빨강 배경 위 빨강은 4.49:1)
export const DANGER_TEXT = "text-destructive hover:text-destructive dark:text-destructive";
