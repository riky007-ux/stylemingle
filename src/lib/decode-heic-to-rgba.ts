type HeicDecodeResult = {
  data: Buffer;
  width: number;
  height: number;
};

const MAX_HEIC_PIXELS = 80_000_000;

let libheifPromise: Promise<any> | null = null;

async function getLibheif() {
  if (!libheifPromise) {
    libheifPromise = import("libheif-js/libheif-wasm/libheif-bundle.mjs").then(
      (module) => module.default ?? module,
    );
  }

  return libheifPromise;
}

export async function decodeHeicToRgba(buffer: Buffer): Promise<HeicDecodeResult> {
  const libheif = await getLibheif();
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(buffer);

  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("No HEIC images found");
  }

  const image = images[0];
  const width = image.get_width();
  const height = image.get_height();

  if (!width || !height || width * height > MAX_HEIC_PIXELS) {
    throw new Error("HEIC dimensions are invalid or too large");
  }

  const data = new Uint8ClampedArray(width * height * 4);
  const displayData = await new Promise<Uint8ClampedArray>((resolve, reject) => {
    image.display(
      { data, width, height },
      (rendered: { data?: Uint8ClampedArray } | null | undefined) => {
        if (!rendered?.data) {
          reject(new Error("HEIC display failed"));
          return;
        }

        resolve(rendered.data);
      },
    );
  });

  return {
    data: Buffer.from(displayData.buffer),
    width,
    height,
  };
}
