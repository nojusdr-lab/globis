"""Browser checks for the synthetic gallery documented in docs/beta-check.md."""
from base64 import b64decode

from playwright.sync_api import expect, sync_playwright


APP_URL = 'http://127.0.0.1:8765'
FIXTURE_URL = 'https://globis-gallery.invalid/'
PIXEL = b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGNUiXZjwAaYsIoOWgkAn0QA1cTePVgAAAAASUVORK5CYII='
)


def route_request(route):
    url = route.request.url
    if url.startswith(f'{APP_URL}/'):
        route.continue_()
    elif url in (f'{FIXTURE_URL}first.png', f'{FIXTURE_URL}third.png'):
        route.fulfill(content_type='image/png', body=PIXEL)
    elif url == f'{FIXTURE_URL}missing.png':
        route.fulfill(status=404, body='')
    else:
        route.abort()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox']
    )
    context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    context.route('**/*', route_request)
    page = context.new_page()
    page.goto(APP_URL)
    page.get_by_role('button', name='Atidaryti profilį:', exact=False).first.click()
    dialog = page.get_by_role('dialog')
    expect(dialog).to_be_visible()

    def expect_photo(index):
        expect(dialog.get_by_text(f'{index} / 3', exact=True)).to_be_visible()
        photo = dialog.get_by_label(f', nuotrauka {index}', exact=False)
        expect(photo).to_be_visible()
        expect(dialog.get_by_text('Nuotraukos nėra', exact=True)).to_have_count(0)

    expect_photo(1)
    dialog.get_by_role('button', name='Kita', exact=True).click()
    expect(dialog.get_by_text('2 / 3', exact=True)).to_be_visible()
    expect(dialog.get_by_text('Nuotraukos nėra', exact=True)).to_be_visible()

    with page.expect_response(f'{FIXTURE_URL}third.png') as loaded:
        dialog.get_by_role('button', name='Kita', exact=True).click()
    assert loaded.value.ok
    expect_photo(3)
    dialog.get_by_role('button', name='Kita', exact=True).click()
    expect_photo(1)
    dialog.get_by_role('button', name='Ankstesnė', exact=True).click()
    expect_photo(3)
    dialog.get_by_role('button', name='Uždaryti', exact=True).click()
    expect(dialog).to_have_count(0)
    page.get_by_role('button', name='Atidaryti profilį:', exact=False).first.click()
    expect_photo(1)
    dialog.get_by_role('button', name='Uždaryti', exact=True).click()
    page.get_by_role('button', name='LT', exact=True).click()
    page.get_by_role('button', name='Open profile:', exact=False).first.click()
    expect(dialog.get_by_role('button', name='Previous', exact=True)).to_be_visible()
    dialog.get_by_role('button', name='Next', exact=True).click()
    expect(dialog.get_by_text('Photo unavailable', exact=True)).to_be_visible()
    browser.close()
    print('PASS: gallery forward/back wrap, failed photo recovery, profile reopen reset, and English labels')
