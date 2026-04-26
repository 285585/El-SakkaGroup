import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { Product } from '../../models/store.models';
import { StoreApiService } from '../../services/store-api.service';

@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.scss'],
})
export class ProductDetailsComponent implements OnInit {
  private readonly fallbackImage = 'assets/images/laptop-placeholder.svg';
  product: Product | null = null;
  activeImage = '';
  zoomBackgroundPosition = '50% 50%';
  zoomVisible = false;
  lensLeft = 0;
  lensTop = 0;

  isLoading = true;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly storeApiService: StoreApiService
  ) {}

  ngOnInit(): void {
    const productId = this.route.snapshot.paramMap.get('id');

    if (!productId) {
      this.errorMessage = 'المنتج غير متاح.';
      this.isLoading = false;
      return;
    }

    this.storeApiService
      .getProductById(productId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (product) => {
          this.product = product;
          this.activeImage = this.productImages[0];
        },
        error: () => {
          this.errorMessage = 'لم يتم العثور على المنتج المطلوب.';
        },
      });
  }

  get productImages(): string[] {
    if (!this.product) {
      return [this.fallbackImage];
    }

    if (Array.isArray(this.product.images) && this.product.images.length > 0) {
      return this.product.images;
    }

    return this.product.image ? [this.product.image] : [this.fallbackImage];
  }

  selectImage(imageUrl: string): void {
    this.activeImage = imageUrl;
    this.zoomVisible = false;
  }

  onMainImageMove(event: MouseEvent): void {
    const container = event.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const pointX = event.clientX - rect.left;
    const pointY = event.clientY - rect.top;
    const lensSize = 120;

    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max);

    this.lensLeft = clamp(pointX - lensSize / 2, 0, Math.max(rect.width - lensSize, 0));
    this.lensTop = clamp(pointY - lensSize / 2, 0, Math.max(rect.height - lensSize, 0));

    const percentX = clamp((pointX / rect.width) * 100, 0, 100);
    const percentY = clamp((pointY / rect.height) * 100, 0, 100);
    this.zoomBackgroundPosition = `${percentX}% ${percentY}%`;
    this.zoomVisible = true;
  }

  onMainImageLeave(): void {
    this.zoomVisible = false;
  }
}
