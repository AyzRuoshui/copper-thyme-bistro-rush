"""
Genuine Chrome playtest & screenshot capture driver for Copper & Thyme: Bistro Rush.
Launches serve.ts, opens /usr/bin/google-chrome via Playwright at 1280x720,
verifies zero console/network errors, exercises keyboard & mouse gameplay,
and captures 4 authentic gameplay/title screenshots.
"""
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ENTRY_ROOT = Path(__file__).resolve().parent.parent
SHOTS_DIR = ENTRY_ROOT / "screenshots"
PORT = 8199

STATIONS = {
    "plates": (132, 228),
    "counter-top-1": (242, 228),
    "skillet-1": (374, 228),
    "skillet-2": (492, 228),
    "pot-1": (610, 228),
    "counter-top-2": (742, 228),
    "pass-ready": (874, 228),
    "serve-bell": (1004, 228),
    "trash": (1126, 228),
    "board-1": (268, 432),
    "board-2": (388, 432),
    "assembly-1": (640, 432),
    "assembly-2": (770, 432),
    "counter-mid-1": (898, 432),
    "crate-bun": (174, 634),
    "crate-patty": (326, 634),
    "crate-salmon": (478, 634),
    "crate-pasta": (630, 634),
    "crate-tomato": (782, 634),
    "crate-greens": (934, 634),
    "crate-mushroom": (1086, 634),
}


def wait_for_server(url: str, timeout: float = 10.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as resp:
                if resp.status == 200:
                    return
        except Exception:
            time.sleep(0.15)
    raise RuntimeError(f"Server did not start at {url}")


def save_canvas_jpeg(page, out_path: Path, quality: int = 86) -> None:
    tmp_png = out_path.with_suffix(".tmp.png")
    page.screenshot(path=str(tmp_png))
    with Image.open(tmp_png) as img:
        rgb = img.convert("RGB")
        rgb.save(out_path, format="JPEG", quality=quality, optimize=True)
    tmp_png.unlink(missing_ok=True)
    size = out_path.stat().st_size
    assert size <= 262144, f"{out_path.name} too large: {size} bytes"
    print(f"Saved {out_path.name}: {size} bytes")


def click_station(page, name: str, wait_sec: float) -> None:
    x, y = STATIONS[name]
    page.mouse.move(x, y)
    page.mouse.click(x, y)
    time.sleep(wait_sec)


def chop_at_board(page, board_name: str, clicks: int = 4) -> None:
    x, y = STATIONS[board_name]
    page.mouse.move(x, y)
    for _ in range(clicks):
        page.mouse.click(x, y)
        time.sleep(0.18)


def main() -> int:
    SHOTS_DIR.mkdir(parents=True, exist_ok=True)
    server = subprocess.Popen(
        ["node", str(ENTRY_ROOT / "serve.ts"), "--port", str(PORT)],
        cwd=str(ENTRY_ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    url = f"http://127.0.0.1:{PORT}/"
    console_errors = []
    page_errors = []
    external_requests = []

    try:
        wait_for_server(url)
        with sync_playwright() as p:
            browser = p.chromium.launch(
                executable_path="/usr/bin/google-chrome",
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = browser.new_context(viewport={"width": 1280, "height": 720})
            page = context.new_page()

            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda err: page_errors.append(str(err)))

            def check_request(req):
                if not req.url.startswith(f"http://127.0.0.1:{PORT}") and not req.url.startswith("data:"):
                    external_requests.append(req.url)

            page.on("request", check_request)

            page.goto(url, wait_until="networkidle")
            time.sleep(0.8)

            # Screenshot 4: Title / Shift Selection screen over live kitchen
            save_canvas_jpeg(page, SHOTS_DIR / "4-title-menu.jpg")

            # Exercise Recipe Book & Mute toggles via keyboard before starting
            page.keyboard.press("KeyR")
            time.sleep(0.2)
            page.keyboard.press("Escape")
            time.sleep(0.2)
            page.keyboard.press("KeyM")
            time.sleep(0.15)
            page.keyboard.press("KeyM")
            time.sleep(0.15)

            # Start Shift 1 via Enter key
            page.keyboard.press("Enter")
            time.sleep(0.35)

            # 1) Build Bistro Burger (#101): Bun -> Assembly 1, Patty -> Skillet 1, Greens -> Board 2 -> Chop -> Assembly 1
            click_station(page, "crate-bun", 1.9)
            click_station(page, "assembly-1", 1.75)

            click_station(page, "crate-patty", 1.25)
            click_station(page, "skillet-1", 1.65)

            click_station(page, "crate-greens", 2.4)
            click_station(page, "board-2", 1.95)
            chop_at_board(page, "board-2", 4)
            click_station(page, "board-2", 0.35)
            click_station(page, "assembly-1", 0.95)

            # Collect Seared Patty -> finish Burger -> place Ready-to-Serve Burger on Heated Pass!
            click_station(page, "skillet-1", 1.3)
            click_station(page, "assembly-1", 1.1)
            click_station(page, "assembly-1", 0.25)
            click_station(page, "pass-ready", 1.1)

            # 2) Start Patty on Skillet 1, chop Tomato halfway on Board 2 for Shot 2
            click_station(page, "crate-patty", 1.55)
            click_station(page, "skillet-1", 1.35)
            click_station(page, "crate-tomato", 1.75)
            click_station(page, "board-2", 1.55)
            chop_at_board(page, "board-2", 2)
            save_canvas_jpeg(page, SHOTS_DIR / "2-prep-and-sear.jpg")

            # Finish Tomato -> Assembly 1 (1/3), Chop Greens -> Assembly 1 (2/3 Crispy Salmon mid-assembly!)
            chop_at_board(page, "board-2", 3)
            click_station(page, "board-2", 0.3)
            click_station(page, "assembly-1", 0.95)
            click_station(page, "crate-greens", 1.4)
            click_station(page, "board-2", 2.0)
            chop_at_board(page, "board-2", 4)
            click_station(page, "board-2", 0.3)
            click_station(page, "assembly-1", 1.0)

            # Plate Seared Patty onto Assembly 2 (1/3 Steak Platter!), start Pasta in Stockpot & Salmon on Skillet 2,
            # then step Chef into central view via keyboard
            click_station(page, "skillet-1", 1.2)
            click_station(page, "assembly-2", 1.25)
            click_station(page, "crate-pasta", 1.2)
            click_station(page, "pot-1", 1.25)
            click_station(page, "crate-salmon", 1.25)
            click_station(page, "skillet-2", 1.25)
            page.keyboard.down("KeyS")
            time.sleep(0.22)
            page.keyboard.up("KeyS")
            page.keyboard.down("KeyD")
            time.sleep(0.28)
            page.keyboard.up("KeyD")
            time.sleep(0.1)

            # Screenshot 1 (Cover): Order Board + Timer + Counter Ingredients + Dish Mid-Assembly (2/3) + Active Skillets/Pot + Ready Plate on Heated Pass!
            save_canvas_jpeg(page, SHOTS_DIR / "1-service-rush.jpg")

            # Wait briefly so Salmon finishes searing, then serve BOTH Burger & Salmon for Combo x2!
            time.sleep(2.8)
            click_station(page, "serve-bell", 1.65)
            click_station(page, "skillet-2", 1.6)
            click_station(page, "assembly-1", 0.95)
            click_station(page, "assembly-1", 0.25)
            click_station(page, "serve-bell", 1.5)
            save_canvas_jpeg(page, SHOTS_DIR / "3-combo-service.jpg")

            live_status = page.locator("#status-live").text_content() or ""
            print("ARIA live status:", live_status)
            assert "Served dish for $" in live_status, f"Expected served announcement, got: {live_status!r}"

            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=5)

    assert not console_errors, f"Console errors: {console_errors}"
    assert not page_errors, f"Page errors: {page_errors}"
    assert not external_requests, f"External network requests detected: {external_requests}"
    print("Chrome playtest passed with 0 console/page/network errors!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
