"""로컬 전용: GPU 워커 접속값을 앱 .env.local 에 쓰고 Modal Secret 을 만든다.

  secret     .env.local 의 GPU_API_TOKEN(없거나 dev-token 이면 새로 만든다)과 HF_TOKEN(있으면)으로
             Modal Secret imagen-local-worker 를 만들거나 덮어쓴다
  url <URL>  배포된 워커 주소(https://…modal.run)를 .env.local 의 GPU_API_URL 에 쓴다

비밀값은 화면·로그·명령 인자에 내지 않는다(Modal CLI 에는 임시 JSON 파일로 넘기고 바로 지운다).
"""

import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

APP_DIR = Path(__file__).resolve().parents[1]
SECRET_NAME = "imagen-local-worker"
DEV_TOKEN = "dev-token"


def read_env(path: Path) -> dict[str, str]:
    """KEY=VALUE 줄만 읽는다(주석·빈 줄 무시, 양끝 따옴표 제거, 같은 키는 뒤가 이긴다). 파일이 없으면 빈 dict."""
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for raw in path.read_text("utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.removeprefix("export ").strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


def _key_of(line: str) -> str:
    return line.split("=", 1)[0].strip().removeprefix("export ").strip() if "=" in line else ""


def set_env_value(path: Path, key: str, value: str) -> None:
    """key 줄을 하나로 바꾼다(첫 자리에 두고 같은 키의 다른 줄·export 줄은 지운다). 없으면 끝에 더하고, 파일이 없으면 만든다."""
    lines = path.read_text("utf-8").splitlines() if path.exists() else []
    out: list[str] = []
    for line in lines:
        if _key_of(line) != key:
            out.append(line)
        elif not any(_key_of(kept) == key for kept in out):
            out.append(f"{key}={value}")
    if not any(_key_of(kept) == key for kept in out):
        out.append(f"{key}={value}")
    path.write_text("\n".join(out) + "\n", "utf-8")


def _create_secret(values: dict[str, str]) -> subprocess.CompletedProcess:
    folder = Path(tempfile.mkdtemp(prefix="imagen-secret-"))
    try:
        file = folder / "secret.json"
        file.write_text(json.dumps(values), "utf-8")
        command = [sys.executable, "-m", "modal", "secret", "create", SECRET_NAME, "--force", "--from-json", str(file)]
        return subprocess.run(command, capture_output=True, text=True)
    finally:
        shutil.rmtree(folder, ignore_errors=True)


def _secret(app_dir: Path) -> int:
    local = app_dir / ".env.local"
    token = read_env(local).get("GPU_API_TOKEN", "")
    if not token or token == DEV_TOKEN:
        token = secrets.token_urlsafe(32)
        set_env_value(local, "GPU_API_TOKEN", token)
    values = {"GPU_API_TOKEN": token}
    hf_token = os.environ.get("HF_TOKEN") or read_env(local).get("HF_TOKEN") or read_env(app_dir / ".env").get("HF_TOKEN")
    if hf_token:
        values["HF_TOKEN"] = hf_token
    result = _create_secret(values)
    if result.returncode != 0:
        first = (result.stderr or result.stdout or "").strip().splitlines()[:1]
        message = first[0] if first else f"exit {result.returncode}"
        for secret in values.values():
            message = message.replace(secret, "***")
        print(f"Modal Secret 을 만들지 못했어요: {message}", file=sys.stderr)
        return 1
    print(f"Modal Secret {SECRET_NAME}: {', '.join(values)}")
    if "HF_TOKEN" not in values:
        # --force 는 Secret 전체를 바꾼다. 대시보드에서만 넣어 둔 값은 여기서 알 수 없다
        print("HF_TOKEN 을 찾지 못해 Secret 에 넣지 않았어요. 대시보드에서 넣어 둔 값이 있었다면 지워졌으니 다시 넣어 주세요", file=sys.stderr)
    return 0


def _is_modal_url(url: str) -> bool:
    # 토큰을 보낼 곳이라 호스트를 직접 본다(문자열 끝만 보면 ?x=.modal.run 같은 주소가 통과한다)
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        return False
    return (
        parts.scheme == "https"
        and (parts.hostname or "").endswith(".modal.run")
        and parts.username is None
        and parts.password is None
        and port is None
        and parts.path in ("", "/")
        and not parts.query
        and not parts.fragment
    )


def _url(app_dir: Path, url: str) -> int:
    if not _is_modal_url(url):
        print("https://…modal.run 주소만 받아요", file=sys.stderr)
        return 2
    set_env_value(app_dir / ".env.local", "GPU_API_URL", url.rstrip("/"))
    print(f"GPU_API_URL={url.rstrip('/')}")
    return 0


def main(argv: list[str], app_dir: Path = APP_DIR) -> int:
    if argv[:1] == ["secret"] and len(argv) == 1:
        return _secret(app_dir)
    if argv[:1] == ["url"] and len(argv) == 2:
        return _url(app_dir, argv[1])
    print("사용법: configure.py secret | configure.py url <https://…modal.run>", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
