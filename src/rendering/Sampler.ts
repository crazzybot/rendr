export class Sampler {
  static createLinearRepeat(device: GPUDevice): GPUSampler {
    return device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      addressModeW: 'repeat',
    });
  }

  static createNearestClamp(device: GPUDevice): GPUSampler {
    return device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      mipmapFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      addressModeW: 'clamp-to-edge',
    });
  }

  static fromGltf(device: GPUDevice, gltfSampler: {
    magFilter?: number;
    minFilter?: number;
    wrapS?: number;
    wrapT?: number;
  }): GPUSampler {
    const magFilter = gltfSampler.magFilter === 9728 ? 'nearest' : 'linear';

    let minFilter: GPUFilterMode = 'linear';
    let mipmapFilter: GPUMipmapFilterMode = 'linear';
    switch (gltfSampler.minFilter) {
      case 9728:
      case 9984:
        minFilter = 'nearest';
        mipmapFilter = 'nearest';
        break;
      case 9985:
        minFilter = 'nearest';
        mipmapFilter = 'linear';
        break;
      case 9986:
        minFilter = 'linear';
        mipmapFilter = 'nearest';
        break;
      default:
        minFilter = 'linear';
        mipmapFilter = 'linear';
        break;
    }

    return device.createSampler({
      magFilter,
      minFilter,
      mipmapFilter,
      addressModeU: this.mapWrapMode(gltfSampler.wrapS),
      addressModeV: this.mapWrapMode(gltfSampler.wrapT),
      addressModeW: 'repeat',
    });
  }

  private static mapWrapMode(wrap?: number): GPUAddressMode {
    switch (wrap) {
      case 33071:
        return 'clamp-to-edge';
      case 33648:
        return 'mirror-repeat';
      case 10497:
      default:
        return 'repeat';
    }
  }
}
