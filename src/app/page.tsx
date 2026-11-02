// 새 채팅 화면 자리. 프롬프트 입력·모델 선택은 src/components/chat 에 만든다
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-2xl font-semibold">imagen-local</h1>
      <p className="text-muted-foreground">이미지 생성 채팅</p>
    </main>
  );
}
