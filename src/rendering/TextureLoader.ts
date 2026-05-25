export interface TextureLoadOptions {
  format?: GPUTextureFormat;
  usage?: GPUTextureUsageFlags;
}

export class TextureLoader {
  static async loadTexture(
    url: string,
    device: GPUDevice,
    options: TextureLoadOptions = {}
  ): Promise<GPUTexture> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load texture: ${url}`);
    }

    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY' });
    const texture = this.createTextureFromBitmap(bitmap, device, options);
    bitmap.close();
    return texture;
  }

  static createTextureFromBitmap(
    bitmap: ImageBitmap,
    device: GPUDevice,
    options: TextureLoadOptions = {}
  ): GPUTexture {
    const texture = device.createTexture({
      size: { width: bitmap.width, height: bitmap.height, depthOrArrayLayers: 1 },
      format: options.format ?? 'rgba8unorm',
      usage: options.usage ?? (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST),
    });

    device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture },
      { width: bitmap.width, height: bitmap.height, depthOrArrayLayers: 1 }
    );

    return texture;
  }

  static createSolidColorTexture(
    device: GPUDevice,
    color: [number, number, number, number] = [255, 255, 255, 255],
    format: GPUTextureFormat = 'rgba8unorm'
  ): GPUTexture {
    const texture = device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const data = new Uint8Array(color);
    device.queue.writeTexture(
      { texture },
      data,
      { bytesPerRow: 4, rowsPerImage: 1 },
      { width: 1, height: 1, depthOrArrayLayers: 1 }
    );

    return texture;
  }
}
