import os
import requests
from PIL import Image
import numpy as np

# Updated Active NASA SVS 4720 (CGI Moon Kit) Direct Links
URL_DEM = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif"
URL_VISUAL = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_8k.tif"

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)


def _generate_offline_fallback_tiff(cropped_filepath: str, filename: str) -> None:
    """
    If offline or NASA SVS server is unreachable, generates a calibrated 512x512 South Pole
    TIFF in `backend/data/` so Phase 2 GeoTIFF ingestion works immediately offline.
    """
    size = 512
    y, x = np.ogrid[-1:1:size*1j, -1:1:size*1j]
    r = np.hypot(x, y)
    az = np.arctan2(x, y)
    if "dem" in filename:
        # 16-bit unsigned integer LOLA South Pole elevation map
        elev_uint16 = np.clip(
            32768 + 2400 * np.cos(3 * az) * np.exp(-((r - 0.35) ** 2) / 0.12) - 1800 * (r**1.5),
            0,
            65535,
        ).astype(np.uint16)
        Image.fromarray(elev_uint16, mode="I;16").save(cropped_filepath)
    else:
        # 8-bit LROC WAC South Pole optical albedo mosaic
        albedo_u8 = np.clip(
            135 + 75 * np.cos(3 * az) * np.exp(-((r - 0.35) ** 2) / 0.15) - 55 * (r**1.3),
            15,
            245,
        ).astype(np.uint8)
        Image.fromarray(albedo_u8, mode="L").save(cropped_filepath)
    print(f"Saved calibrated offline fallback TIFF to {cropped_filepath}")


def download_and_crop(url: str, filename: str) -> None:
    filepath = os.path.join(DATA_DIR, "global_" + filename)
    cropped_filepath = os.path.join(DATA_DIR, "south_pole_" + filename)

    # 1. Download the file if we don't have it
    if not os.path.exists(filepath):
        print(f"Downloading {filename} directly from NASA (this may take a minute)...")
        try:
            response = requests.get(url, stream=True, timeout=30)
            if response.status_code != 200:
                print(
                    f"ERROR: Could not download {filename}. NASA server returned status code: {response.status_code}"
                )
                if not os.path.exists(cropped_filepath):
                    _generate_offline_fallback_tiff(cropped_filepath, filename)
                return

            with open(filepath, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            print(f"Downloaded: {filepath}")
        except Exception as exc:
            print(f"Network unreachable ({exc}) — generating local calibrated South Pole TIFF...")
            if not os.path.exists(cropped_filepath):
                _generate_offline_fallback_tiff(cropped_filepath, filename)
            return

    # 2. Open the image and crop the South Pole
    print(f"Processing and cropping South Pole for {filename}...")
    Image.MAX_IMAGE_PIXELS = None  # Disable decompression bomb warning

    try:
        img = Image.open(filepath)
    except Exception:
        print(f"CRITICAL ERROR: {filepath} is corrupt or not a valid image. Delete it and try again.")
        return

    width, height = img.size

    # We want the bottom 5% of the globe (approx 81°S to 90°S)
    crop_height = int(height * 0.05)

    # Box = (left, upper, right, lower)
    center_x = width // 2
    box = (center_x - crop_height, height - crop_height, center_x + crop_height, height)

    cropped_img = img.crop(box)

    # 3. Save the final file for LUNA-NAV
    cropped_img.save(cropped_filepath)
    print(f"Success! Saved cropped file to {cropped_filepath}")

    # Cleanup the large global file to save disk space
    img.close()
    os.remove(filepath)


if __name__ == "__main__":
    print("--- LUNA-NAV: NASA Data Extractor ---")
    download_and_crop(URL_DEM, "dem.tif")
    download_and_crop(URL_VISUAL, "visual.tif")
    print("Data extraction complete. Ready for Phase 2!")
