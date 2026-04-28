import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Product } from '../../models/store.models';
import {
  getLocalLaptopVariantPath,
  getProductImageUrl,
  isLocalVariantPath,
} from '../../utils/product-image.util';
import { CartService } from '../../services/cart.service';
import { OwnerAuthService } from '../../services/owner-auth.service';
import { RecentlyViewedService } from '../../services/recently-viewed.service';
import { StoreApiService } from '../../services/store-api.service';
import { WishlistService } from '../../services/wishlist.service';
import { PUBLIC_CONTACT_FOR_PRICING } from '../../constants/public-pricing.message';

@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.scss'],
})
export class ProductDetailsComponent implements OnInit {
  readonly publicPricingHint = PUBLIC_CONTACT_FOR_PRICING;

  product: Product | null = null;
  activeImage = '';
  thumbOverride: { [key: number]: string } = {};
  zoomBackgroundPosition = '50% 50%';
  zoomVisible = false;
  lensLeft = 0;
  lensTop = 0;

  isLoading = true;
  errorMessage = '';
  successMessage = '';
  ratingError = '';
  ratingToSubmit: number = 5;
  isSubmittingRating = false;

  get isAuthenticated$(): Observable<boolean> {
    return this.ownerAuthService.isAuthenticated$;
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly storeApiService: StoreApiService,
    private readonly cartService: CartService,
    private readonly wishlistService: WishlistService,
    private readonly recentlyViewedService: RecentlyViewedService,
    private readonly ownerAuthService: OwnerAuthService
  ) {}

  ngOnInit(): void {
    const productId = this.route.snapshot.paramMap.get('id');

    if (!productId) {
      this.errorMessage = 'المنتج غير متاح.';
      this.isLoading = false;
      return;
    }

    this.reloadProduct(productId);
  }

  private reloadProduct(productId: string): void {
    this.isLoading = true;
    const token = this.ownerAuthService.getToken();
    this.storeApiService
      .getProductById(productId, token)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (product) => {
          this.product = product;
          this.thumbOverride = {};
          this.activeImage = this.productImages[0];
          this.recentlyViewedService.add(product);
          if (product.myRating != null && product.myRating > 0) {
            this.ratingToSubmit = product.myRating;
          }
        },
        error: () => {
          this.errorMessage = 'لم يتم العثور على المنتج المطلوب.';
        },
      });
  }

  get productImages(): string[] {
    if (!this.product) {
      return [];
    }

    if (Array.isArray(this.product.images) && this.product.images.length > 0) {
      return this.product.images;
    }

    if (this.product.image) {
      return [this.product.image];
    }

    return [getProductImageUrl(this.product)];
  }

  getThumbUrl(index: number, original: string): string {
    return this.thumbOverride[index] ?? original;
  }

  onMainImageError(): void {
    if (!this.product) {
      return;
    }
    if (isLocalVariantPath(this.activeImage)) {
      return;
    }
    this.activeImage = getLocalLaptopVariantPath(this.product.id);
  }

  onThumbError(index: number, original: string): void {
    if (!this.product) {
      return;
    }
    if (isLocalVariantPath(original)) {
      return;
    }
    const fallback = getLocalLaptopVariantPath(this.product.id);
    this.thumbOverride[index] = fallback;
    if (this.activeImage === original) {
      this.activeImage = fallback;
    }
  }

  selectImage(imageUrl: string): void {
    this.activeImage = imageUrl;
    this.zoomVisible = false;
  }

  addToCart(): void {
    if (!this.product) {
      return;
    }

    if (Number(this.product.stock) <= 0) {
      this.errorMessage = 'هذا المنتج غير متوفر حالياً.';
      return;
    }

    this.cartService.addProduct(this.product);
    this.successMessage = 'تمت إضافة المنتج إلى السلة.';
  }

  buyNow(): void {
    if (!this.product || Number(this.product.stock) <= 0) {
      this.errorMessage = 'هذا المنتج غير متوفر حالياً.';
      return;
    }

    this.errorMessage = '';
    this.router.navigate(['/checkout'], { queryParams: { productId: this.product.id, qty: 1 } });
  }

  toggleWishlist(): void {
    if (!this.product) {
      return;
    }

    this.wishlistService.toggle(this.product);
    this.successMessage = this.isWishlisted ? 'تمت إضافة المنتج إلى المفضلة.' : 'تمت إزالة المنتج من المفضلة.';
  }

  get isWishlisted(): boolean {
    if (!this.product) {
      return false;
    }

    return this.wishlistService.has(this.product.id);
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

  submitRating(): void {
    if (!this.product) {
      return;
    }

    const token = this.ownerAuthService.getToken();
    this.ratingError = '';
    this.successMessage = '';

    if (!token) {
      this.ratingError = 'سجّل الدخول كعميل لتتمكن من التقييم.';
      return;
    }

    if (this.currentUser?.role === 'owner') {
      this.ratingError = 'حساب المالك لا يضيف تقييماً للمنتجات.';
      return;
    }

    this.isSubmittingRating = true;
    this.storeApiService
      .rateProduct(this.product.id, this.ratingToSubmit, token)
      .pipe(finalize(() => (this.isSubmittingRating = false)))
      .subscribe({
        next: (res) => {
          this.successMessage = res.message;
          if (this.product) {
            this.product = {
              ...this.product,
              averageRating: res.averageRating,
              ratingsCount: res.ratingsCount,
              myRating: res.myRating,
              canRate: true,
            };
          }
        },
        error: (error: HttpErrorResponse) => {
          this.ratingError =
            typeof error.error?.message === 'string' && error.error.message.trim()
              ? error.error.message
              : 'تعذر حفظ التقييم.';
        },
      });
  }

  get currentUser() {
    return this.ownerAuthService.getCurrentUser();
  }
}
