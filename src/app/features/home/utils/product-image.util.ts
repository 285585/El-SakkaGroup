import { Product } from '../models/store.models';

const VARIANT_COUNT = 8;
const ASSET_DIR = 'assets/images/laptops';

function hashId(productId: string): number {
  let h = 0;
  for (let i = 0; i < productId.length; i++) {
    h = (h << 5) - h + productId.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** صورة لونية مميّزة لكل منتج (بدون الاعتماد على السيرفر) */
export function getLocalLaptopVariantPath(productId: string): string {
  const idx = hashId(productId) % VARIANT_COUNT;
  return `${ASSET_DIR}/variant-${idx}.svg`;
}

export function getProductImageUrl(
  product: Pick<Product, 'id' | 'image' | 'images'>
): string {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images[0];
  }
  if (product.image) {
    return product.image;
  }
  return getLocalLaptopVariantPath(product.id);
}

export function isLocalVariantPath(url: string): boolean {
  return url.startsWith(`${ASSET_DIR}/`);
}
