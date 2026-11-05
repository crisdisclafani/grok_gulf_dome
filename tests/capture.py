from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path('/workspace/gulf-dome-demo/screenshots')
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path='/usr/bin/google-chrome', headless=True,
        args=['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'])
    for name, width, height, mobile in [('desktop-1440', 1440, 900, False), ('mobile-390', 390, 844, True)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, is_mobile=mobile,
                                has_touch=mobile, device_scale_factor=1)
        errors = []
        page.on('console', lambda msg, errors=errors: errors.append(f'console {msg.type}: {msg.text}') if msg.type == 'error' else None)
        page.on('pageerror', lambda err, errors=errors: errors.append(f'pageerror: {err}'))
        page.goto('http://localhost:8917/app/index.html?capture', wait_until='networkidle', timeout=60000)
        page.wait_for_function('window.__ready === true', timeout=60000)
        page.evaluate('window.__advance(360)')
        page.screenshot(path=str(ROOT / f'{name}-aerial.png'))
        dome = page.locator('#hotspots .hs[data-id=dome]')
        assert dome.count() == 1, f'{name}: dome pin missing from scene'
        assert not page.locator('#intro').is_visible(), f'{name}: intro panel still blocks the campus'
        if mobile:
            page.screenshot(path=str(ROOT / f'{name}-aerial-explore.png'))
        assert dome.is_visible(), f'{name}: dome pin not visible'
        dome.click()
        page.evaluate('window.__advance(100)')
        page.evaluate('window.__frame(0)')
        page.screenshot(path=str(ROOT / f'{name}-dome-selected.png'))
        assert dome.evaluate("e => e.classList.contains('sel')"), f'{name}: dome pin not selected'
        assert page.locator('#toast').inner_text() == 'Visitor Centre · concept — the interior comes next'
        assert not errors, f'{name}: {errors}'
        print(f'{name}: aerial, selected dome, camera flight, toast, zero console errors — OK')
        page.close()
    browser.close()
