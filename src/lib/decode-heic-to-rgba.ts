type HeicDecodeResult = {
  data: Buffer;
  width: number;
  height: number;
};

type LibheifRuntime = { HeifDecoder: new () => any };

const MAX_HEIC_PIXELS = 80_000_000;

let libheifPromise: Promise<LibheifRuntime> | null = null;

function assertLibheifRuntime(candidate: any): asserts candidate is LibheifRuntime {
  if (!candidate || typeof candidate.HeifDecoder !== "function") {
    const keys = candidate && typeof candidate === "object" ? Object.keys(candidate).slice(0, 20) : [];
    console.warn("HEIC decoder unavailable: HeifDecoder missing", {
      candidateType: typeof candidate,
      keys,
    });
    throw new Error(
      `libheif import shape invalid: HeifDecoder missing (type=${typeof candidate}, keys=${keys.join(",")})`,
    );
  }
}

async function getLibheif() {
  if (!libheifPromise) {
    libheifPromise = import("libheif-js/wasm-bundle")
      .then((mod) => {
        const lib = (mod as any)?.default ?? mod;
        const candidate = (lib as any)?.default ?? lib;
        assertLibheifRuntime(candidate);
        return candidate;
      })
      .catch((err) => {
        libheifPromise = null;
        throw err;
      });
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
