import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { Product } from 'src/app/features/home/models/store.models';
import { getLocalLaptopVariantPath, getProductImageUrl } from 'src/app/features/home/utils/product-image.util';

@Directive({
  selector: 'img[appProductImage]',
  standalone: true,
})
export class ProductImageDirective implements OnChanges {
  @Input('appProductImage') product!: Product;
  @Input() appProductImageSrc: string | null | undefined;

  private triedFallback = false;

  constructor(private readonly el: ElementRef<HTMLImageElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.product) {
      return;
    }
    if (!changes['product'] && !changes['appProductImageSrc']) {
      return;
    }
    this.triedFallback = false;
    const use =
      (this.appProductImageSrc && String(this.appProductImageSrc).trim()) || getProductImageUrl(this.product);
    this.el.nativeElement.src = use;
  }

  @HostListener('error')
  onError(): void {
    if (this.triedFallback || !this.product) {
      return;
    }
    this.triedFallback = true;
    this.el.nativeElement.src = getLocalLaptopVariantPath(this.product.id);
  }
}
