import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import {
  CartItem,
  CreateOrderRequest,
  Product,
  ProductFilters,
} from '../../models/store.models';
import { OwnerAuthService } from '../../services/owner-auth.service';
import { StoreApiService } from '../../services/store-api.service';

@Component({
  selector: 'app-storefront',
  templateUrl: './storefront.component.html',
  styleUrls: ['./storefront.component.scss']
})
export class StorefrontComponent implements OnInit {
  products: Product[] = [];
  allProducts: Product[] = [];
  brands: string[] = [];
  cart: CartItem[] = [];
  searchSuggestions: Product[] = [];
  showSearchSuggestions = false;

  filters: ProductFilters = {
    search: '',
    brand: 'all',
    sort: 'featured',
  };

  customerName = '';
  email = '';
  phone = '';
  city = '';
  address = '';

  isLoadingProducts = false;
  isSubmittingOrder = false;
  isDeletingProductId = '';
  ownerMode = false;
  errorMessage = '';
  successMessage = '';
  ownerActionMessage = '';

  readonly sortOptions = [
    { value: 'featured', label: 'المميزة' },
    { value: 'priceAsc', label: 'السعر: الأقل أولاً' },
    { value: 'priceDesc', label: 'السعر: الأعلى أولاً' },
    { value: 'rating', label: 'الأعلى تقييماً' },
  ];

  constructor(
    private readonly storeApiService: StoreApiService,
    private readonly ownerAuthService: OwnerAuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.ownerAuthService.isSessionValid().subscribe((isValid) => {
      this.ownerMode = isValid;
    });
    this.loadBrands();
    this.loadAllProducts();
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoadingProducts = true;
    this.errorMessage = '';

    this.storeApiService
      .getProducts(this.filters)
      .pipe(finalize(() => (this.isLoadingProducts = false)))
      .subscribe({
        next: (response) => {
          this.products = response.products;
          this.mergeProductsForSuggestions(response.products);
          this.updateSearchSuggestions(this.filters.search || '');
        },
        error: () => {
          this.errorMessage =
            'حصل خطأ أثناء تحميل المنتجات. تأكد من تشغيل الباك إند وجرب مرة تانية.';
        },
      });
  }

  loadAllProducts(): void {
    this.storeApiService
      .getProducts({ brand: 'all', sort: 'featured', search: '' })
      .subscribe({
        next: (response) => {
          this.allProducts = response.products;
        },
        error: () => {
          this.allProducts = [];
        },
      });
  }

  loadBrands(): void {
    this.storeApiService.getBrands().subscribe({
      next: (brands) => {
        this.brands = brands;
      },
      error: () => {
        this.brands = [];
      },
    });
  }

  addToCart(product: Product): void {
    const existingItem = this.cart.find((entry) => entry.product.id === product.id);

    if (existingItem) {
      existingItem.quantity += 1;
      return;
    }

    this.cart.push({ product, quantity: 1 });
  }

  increaseQuantity(item: CartItem): void {
    item.quantity += 1;
  }

  decreaseQuantity(item: CartItem): void {
    if (item.quantity <= 1) {
      this.removeFromCart(item.product.id);
      return;
    }

    item.quantity -= 1;
  }

  removeFromCart(productId: string): void {
    this.cart = this.cart.filter((item) => item.product.id !== productId);
  }

  editProduct(productId: string): void {
    this.router.navigate(['/owner/dashboard'], {
      queryParams: {
        editId: productId,
      },
    });
  }

  deleteProduct(productId: string): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      this.errorMessage = 'يجب تسجيل دخول المالك أولاً.';
      return;
    }

    const confirmed = window.confirm('هل تريد حذف هذا المنتج نهائياً؟');
    if (!confirmed) {
      return;
    }

    this.isDeletingProductId = productId;
    this.ownerActionMessage = '';
    this.errorMessage = '';

    this.storeApiService
      .deleteProduct(productId, token)
      .pipe(finalize(() => (this.isDeletingProductId = '')))
      .subscribe({
        next: () => {
          this.ownerActionMessage = 'تم حذف المنتج بنجاح.';
          this.loadBrands();
          this.loadAllProducts();
          this.loadProducts();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 401) {
            this.errorMessage = 'جلسة المالك انتهت. سجل الدخول مرة أخرى.';
            this.ownerAuthService.logout();
            return;
          }

          this.errorMessage =
            typeof error.error?.message === 'string' && error.error.message.trim()
              ? error.error.message
              : 'تعذر حذف المنتج حالياً.';
        },
      });
  }

  onSearchInputChange(value: string): void {
    this.filters.search = value;
    this.updateSearchSuggestions(value);
    this.showSearchSuggestions = Boolean(value.trim());
  }

  onSearchFocus(): void {
    const searchTerm = this.filters.search || '';
    this.updateSearchSuggestions(searchTerm);
    this.showSearchSuggestions = Boolean(searchTerm.trim());
  }

  onSearchBlur(): void {
    window.setTimeout(() => {
      this.showSearchSuggestions = false;
    }, 150);
  }

  onSearchEnter(): void {
    this.showSearchSuggestions = false;
    this.loadProducts();
  }

  selectSuggestion(product: Product): void {
    this.filters.search = product.name;
    this.showSearchSuggestions = false;
    this.searchSuggestions = [];
    this.loadProducts();
  }

  placeOrder(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.customerName || !this.email || !this.phone || !this.city || !this.address) {
      this.errorMessage = 'من فضلك اكمل بيانات الطلب قبل الإرسال.';
      return;
    }

    if (this.cart.length === 0) {
      this.errorMessage = 'السلة فارغة. أضف منتج واحد على الأقل.';
      return;
    }

    const payload: CreateOrderRequest = {
      customerName: this.customerName.trim(),
      email: this.email.trim(),
      phone: this.phone.trim(),
      city: this.city.trim(),
      address: this.address.trim(),
      items: this.cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    };

    this.isSubmittingOrder = true;

    this.storeApiService
      .createOrder(payload)
      .pipe(finalize(() => (this.isSubmittingOrder = false)))
      .subscribe({
        next: (response) => {
          this.successMessage = `تم إرسال طلبك بنجاح. رقم الطلب: ${response.order.id}`;
          this.cart = [];
          this.customerName = '';
          this.email = '';
          this.phone = '';
          this.city = '';
          this.address = '';
        },
        error: () => {
          this.errorMessage = 'تعذر إرسال الطلب حالياً. حاول مرة أخرى بعد قليل.';
        },
      });
  }

  get cartItemsCount(): number {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  get cartSubtotal(): number {
    return this.cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }

  get shippingCost(): number {
    return this.cartSubtotal >= 50000 || this.cart.length === 0 ? 0 : 350;
  }

  get cartTotal(): number {
    return this.cartSubtotal + this.shippingCost;
  }

  trackByProduct(_index: number, item: Product): string {
    return item.id;
  }

  trackByCartItem(_index: number, item: CartItem): string {
    return item.product.id;
  }

  private updateSearchSuggestions(term: string): void {
    const normalizedTerm = term.trim().toLowerCase();
    if (!normalizedTerm) {
      this.searchSuggestions = [];
      return;
    }

    const sourceProducts = this.allProducts.length > 0 ? this.allProducts : this.products;

    this.searchSuggestions = sourceProducts
      .filter((product) => this.buildProductSearchText(product).includes(normalizedTerm))
      .slice(0, 8);
  }

  private buildProductSearchText(product: Product): string {
    return [
      product.id,
      product.name,
      product.brand,
      product.category,
      product.price,
      product.oldPrice,
      product.stock,
      product.shortDescription,
      product.specs.cpu,
      product.specs.ram,
      product.specs.storage,
      product.specs.gpu,
    ]
      .join(' ')
      .toLowerCase();
  }

  private mergeProductsForSuggestions(products: Product[]): void {
    const merged = new Map(this.allProducts.map((item) => [item.id, item]));
    products.forEach((product) => {
      merged.set(product.id, product);
    });
    this.allProducts = Array.from(merged.values());
  }
}
