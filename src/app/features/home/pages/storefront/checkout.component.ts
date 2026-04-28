import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { CreateOrderRequest, Product } from '../../models/store.models';
import { CartService } from '../../services/cart.service';
import { OwnerAuthService } from '../../services/owner-auth.service';
import { StoreApiService } from '../../services/store-api.service';
import { PUBLIC_CONTACT_FOR_PRICING } from '../../constants/public-pricing.message';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
})
export class CheckoutComponent implements OnInit {
  readonly publicPricingHint = PUBLIC_CONTACT_FOR_PRICING;

  customerName = '';
  email = '';
  phone = '';

  city = '';
  area = '';
  addressLine1 = '';
  addressLine2 = '';
  buildingNo = '';
  floorNo = '';
  apartmentNo = '';
  landmark = '';
  postalCode = '';
  notes = '';

  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  /** طلب شراء مباشر من صفحة المنتج */
  readonly productIdFromQuery: string | null;
  directProduct: Product | null = null;
  directQty = 1;
  directLoadError = '';
  isLoadingDirectProduct = false;

  constructor(
    private readonly cartService: CartService,
    private readonly ownerAuthService: OwnerAuthService,
    private readonly storeApiService: StoreApiService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.productIdFromQuery = this.route.snapshot.queryParamMap.get('productId')?.trim() || null;
  }

  ngOnInit(): void {
    const user = this.ownerAuthService.getCurrentUser();
    if (user?.email) {
      this.email = user.email;
    }
    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    if (fullName) {
      this.customerName = fullName;
    } else if (user?.username) {
      this.customerName = user.username;
    }
    if (user?.phone) {
      this.phone = user.phone;
    }

    if (this.productIdFromQuery) {
      const qtyRaw = this.route.snapshot.queryParamMap.get('qty');
      const preferred = Math.max(1, parseInt(String(qtyRaw || '1'), 10) || 1);
      this.loadDirectProduct(this.productIdFromQuery, preferred);
      return;
    }

    if (this.cartService.getItems().length === 0) {
      this.router.navigate(['/cart']);
    }
  }

  get pageTitle(): string {
    return this.directProduct ? 'تقديم طلب شراء' : 'تأكيد الطلب';
  }

  get showCheckoutForm(): boolean {
    if (this.productIdFromQuery) {
      return Boolean(this.directProduct && this.directProduct.stock > 0 && !this.isLoadingDirectProduct);
    }
    return this.cartService.getItems().length > 0 && !this.isLoadingDirectProduct;
  }

  submitOrder(): void {
    this.errorMessage = '';
    this.successMessage = '';

    const token = this.ownerAuthService.getToken();
    if (!token) {
      this.errorMessage = 'لازم تسجل الدخول أولاً قبل إتمام الطلب.';
      return;
    }

    if (
      !this.customerName ||
      !this.email ||
      !this.phone ||
      !this.city ||
      !this.addressLine1
    ) {
      this.errorMessage = 'من فضلك أكمل بيانات العميل والعنوان.';
      return;
    }

    let items: Array<{ productId: string; quantity: number }>;

    if (this.directProduct) {
      if (this.directProduct.stock <= 0) {
        this.errorMessage = 'هذا المنتج غير متوفر للطلب حالياً.';
        return;
      }
      const q = Math.min(
        Math.max(1, Math.floor(Number(this.directQty) || 1)),
        this.directProduct.stock
      );
      items = [{ productId: this.directProduct.id, quantity: q }];
    } else {
      const cartItems = this.cartService.getItems();
      if (cartItems.length === 0) {
        this.errorMessage = 'سلة المشتريات فارغة.';
        return;
      }
      items = cartItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }));
    }

    const payload: CreateOrderRequest = {
      customerName: this.customerName.trim(),
      email: this.email.trim(),
      phone: this.phone.trim(),
      city: this.city.trim(),
      area: this.area.trim(),
      addressLine1: this.addressLine1.trim(),
      addressLine2: this.addressLine2.trim(),
      buildingNo: this.buildingNo.trim(),
      floorNo: this.floorNo.trim(),
      apartmentNo: this.apartmentNo.trim(),
      landmark: this.landmark.trim(),
      postalCode: this.postalCode.trim(),
      notes: this.notes.trim(),
      items,
    };

    this.isSubmitting = true;
    this.storeApiService
      .createOrder(payload, token)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (response) => {
          this.successMessage = `تم إتمام طلبك بنجاح. رقم الطلب: ${response.order.id}`;
          this.cartService.clear();
          window.setTimeout(() => {
            this.router.navigate(['/']);
          }, 1600);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 401) {
            this.ownerAuthService.logout('/login');
            return;
          }

          this.errorMessage =
            typeof error.error?.message === 'string' && error.error.message.trim()
              ? error.error.message
              : 'تعذر إتمام الطلب حالياً، حاول مرة أخرى.';
        },
      });
  }

  private loadDirectProduct(productId: string, preferredQty: number): void {
    this.isLoadingDirectProduct = true;
    this.directLoadError = '';
    this.directProduct = null;

    const token = this.ownerAuthService.getToken();
    this.storeApiService
      .getProductById(productId, token)
      .pipe(finalize(() => (this.isLoadingDirectProduct = false)))
      .subscribe({
        next: (product) => {
          if (product.stock <= 0) {
            this.directLoadError = 'هذا المنتج غير متوفر للطلب حالياً.';
            return;
          }
          this.directProduct = product;
          this.directQty = Math.min(Math.max(1, preferredQty), product.stock);
        },
        error: () => {
          this.directLoadError = 'تعذر تحميل المنتج أو أنه غير موجود.';
        },
      });
  }
}
