type HeicDecodeResult = {
  data: Buffer;
  width: number;
  height: number;
};

type LibheifModuleShape = {
  HeifDecoder?: new () => {
    decode: (buffer: Buffer) => any[];
  };
};

const MAX_HEIC_PIXELS = 80_000_000;

let libheifPromise: Promise<LibheifModuleShape> | null = null;

function describeCandidate(candidate: unknown) {
  const candidateType = typeof candidate;
  const candidateKeys =
    candidate && typeof candidate === "object"
      ? Object.keys(candidate as Record<string, unknown>).slice(0, 20)
      : [];

  return { candidateType, candidateKeys };
}

async function getLibheif() {
  if (!libheifPromise) {
    libheifPromise = import("libheif-js/wasm-bundle")
      .then((module) => {
        const lib = module?.default ?? module;
        const candidate = lib?.default ?? lib;

        if (!candidate?.HeifDecoder || typeof candidate.HeifDecoder !== "function") {
          const { candidateType, candidateKeys } = describeCandidate(candidate);
          console.warn("HEIC decoder unavailable: HeifDecoder missing", {
            candidateType,
            candidateKeys,
          });

          throw new Error(
            `Invalid libheif export shape: type=${candidateType} keys=${candidateKeys.join(",")}`,
          );
        }

        return candidate as LibheifModuleShape;
      })
      .catch((error) => {
        libheifPromise = null;
        throw error;
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
