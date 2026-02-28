export type BackgroundRemovalResult = {
  file: File;
  previewUrl: string;
};

function colorDistance(a: [number, number, number], b: [number, number, number]) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export async function removeBackgroundClientSide(file: File): Promise<BackgroundRemovalResult> {
  const imageBitmap = await createImageBitmap(file);
  const width = imageBitmap.width;
  const height = imageBitmap.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Unable to create image context");
  }

  ctx.drawImage(imageBitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const corners: [number, number, number][] = [
    [data[0], data[1], data[2]],
    [data[(width - 1) * 4], data[(width - 1) * 4 + 1], data[(width - 1) * 4 + 2]],
    [data[(height - 1) * width * 4], data[(height - 1) * width * 4 + 1], data[(height - 1) * width * 4 + 2]],
    [
      data[(height * width - 1) * 4],
      data[(height * width - 1) * 4 + 1],
      data[(height * width - 1) * 4 + 2],
    ],
  ];

  const avgBackground: [number, number, number] = [
    Math.round(corners.reduce((sum, c) => sum + c[0], 0) / corners.length),
    Math.round(corners.reduce((sum, c) => sum + c[1], 0) / corners.length),
    Math.round(corners.reduce((sum, c) => sum + c[2], 0) / corners.length),
  ];

  const threshold = 52;
  const featherStart = threshold - 12;

  for (let i = 0; i < data.length; i += 4) {
    const dist = colorDistance([data[i], data[i + 1], data[i + 2]], avgBackground);

    if (dist <= featherStart) {
      data[i + 3] = 0;
      continue;
    }

    if (dist <= threshold) {
      const ratio = (dist - featherStart) / (threshold - featherStart);
      data[i + 3] = Math.min(data[i + 3], Math.round(255 * ratio));
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const enhancedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Background removal export failed"));
        return;
      }
      resolve(blob);
    }, "image/png", 0.92);
  });

  const outputName = file.name.replace(/\.[^.]+$/, "") || "enhanced";
  const outputFile = new File([enhancedBlob], `${outputName}.png`, {
    type: "image/png",
    lastModified: Date.now(),
  });

  const previewUrl = canvas.toDataURL("image/png", 0.9);

  return {
    file: outputFile,
    previewUrl,
  };
}
