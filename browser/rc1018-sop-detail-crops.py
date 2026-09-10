from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / 'assets' / 'sop' / 'screenshots'

CROPS = {
    'rc1018-customers-masterdata-detail.png': ('rc1018-customers.png', (270, 300, 1390, 1100)),
    'rc1018-customers-mailcontacts-detail.png': ('rc1018-customers.png', (270, 1050, 1390, 3200)),
    'rc1018-shipping-route-inputs-detail.png': ('rc1018-shipping-route.png', (270, 300, 1390, 1150)),
    'rc1018-shipping-result-detail.png': ('rc1018-shipping-route.png', (270, 1400, 1390, 2150)),
    'rc1018-pallet-booking-detail.png': ('rc1018-pallet-account.png', (270, 280, 1390, 1030)),
    'rc1018-pallet-reconciliation-detail.png': ('rc1018-pallet-account.png', (270, 950, 1390, 1620)),
    'rc1018-sop-controlled-document-detail.png': ('rc1018-sop-handbook.png', (270, 320, 1390, 1600)),
    'rc1018-sop-editor-detail.png': ('rc1018-sop-handbook.png', (270, 4500, 1390, 5300)),
    'rc1018-academy-overview-detail.png': ('rc1018-academy.png', (270, 200, 1390, 900)),
    'rc1018-academy-test-detail.png': ('rc1018-academy.png', (270, 830, 1390, 1550)),
    'rc1018-release-status-detail.png': ('rc1018-release-center.png', (270, 180, 1390, 850)),
    'rc1018-release-checklist-detail.png': ('rc1018-release-center.png', (270, 800, 1390, 1540)),
}


def generate(output_name: str, source_name: str, box: tuple[int, int, int, int]) -> None:
    source = SCREENSHOTS / source_name
    output = SCREENSHOTS / output_name
    if not source.is_file():
        raise FileNotFoundError(f'Quellbild fehlt: {source}')

    with Image.open(source) as image:
        image.load()
        width, height = image.size
        left, top, right, bottom = box
        if left < 0 or top < 0 or right > width or bottom > height or right <= left or bottom <= top:
            raise ValueError(
                f'Ungueltiger Ausschnitt fuer {source_name}: {box}, Quelle={width}x{height}'
            )
        cropped = image.crop(box).convert('RGB')
        quantized = cropped.quantize(
            colors=256,
            method=Image.Quantize.MEDIANCUT,
            dither=Image.Dither.NONE,
        )
        quantized.save(output, format='PNG', optimize=True)

    size = output.stat().st_size
    if size < 10_000:
        raise ValueError(f'Detailbild unplausibel klein: {output_name} ({size} Bytes)')
    print(f'{output_name}: {size} Bytes')


def main() -> None:
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    for output_name, (source_name, box) in CROPS.items():
        generate(output_name, source_name, box)
    print(f'RC1018 SOP-Detailbilder erzeugt: {len(CROPS)}')


if __name__ == '__main__':
    main()
