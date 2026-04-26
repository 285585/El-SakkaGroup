import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Product, ProductFilters } from '../../models/store.models';
import { CartService } from '../../services/cart.service';
import { OwnerAuthService } from '../../services/owner-auth.service';
import { RecentlyViewedService } from '../../services/recently-viewed.service';
import { StoreApiService } from '../../services/store-api.service';
import { WishlistService } from '../../services/wishlist.service';

@Component({
  selector: 'app-storefront',
  templateUrl: './storefront.component.html',
  styleUrls: ['./storefront.component.scss']
})
export class StorefrontComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  allProducts: Product[] = [];
  recentlyViewed: Product[] = [];
  wishlistIds = new Set<string>();
  brands: string[] = [];
  searchSuggestions: Product[] = [];
  showSearchSuggestions = false;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly subscriptions: Subscription[] = [];

  filters: ProductFilters = {
    search: '',
    brand: 'all',
    sort: 'featured',
    minPrice: null,
    maxPrice: null,
    inStock: false,
  };

  selectedSection: 'all' | 'laptops' | 'accessories' = 'all';

  isLoadingProducts = false;
  isDeletingProductId = '';
  ownerMode = false;
  errorMessage = '';
  ownerActionMessage = '';
  currentPage = 1;
  readonly pageSize = 10;

  readonly sortOptions = [
    { value: 'featured', label: 'المميزة' },
    { value: 'priceAsc', label: 'السعر: الأقل أولاً' },
    { value: 'priceDesc', label: 'السعر: الأعلى أولاً' },
    { value: 'rating', label: 'الأعلى تقييماً' },
  ];

  constructor(
    private readonly storeApiService: StoreApiService,
    private readonly cartService: CartService,
    private readonly ownerAuthService: OwnerAuthService,
    private readonly wishlistService: WishlistService,
    private readonly recentlyViewedService: RecentlyViewedService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.ownerAuthService.ownerMode$.subscribe((isOwnerMode) => {
        this.ownerMode = isOwnerMode;
      })
    );
    this.subscriptions.push(this.ownerAuthService.isSessionValid().subscribe());
    this.subscriptions.push(
      this.wishlistService.wishlist$.subscribe((items) => {
        this.wishlistIds = new Set(items.map((item) => item.id));
      })
    );
    this.subscriptions.push(
      this.recentlyViewedService.viewed$.subscribe((items) => {
        this.recentlyViewed = items.slice(0, 8);
      })
    );
    this.loadBrands();
    this.loadAllProducts();
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.clearSearchDebounce();
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
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
          this.currentPage = 1;
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
      .getProducts({
        brand: 'all',
        sort: 'featured',
        search: '',
        minPrice: null,
        maxPrice: null,
        inStock: false,
      })
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
    if (this.isOutOfStock(product)) {
      this.errorMessage = 'هذا المنتج غير متوفر حالياً.';
      return;
    }

    this.cartService.addProduct(product);
    this.ownerActionMessage = `تمت إضافة "${product.name}" إلى السلة.`;
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
    this.clearSearchDebounce();
    this.searchDebounceTimer = window.setTimeout(() => {
      this.loadProducts();
    }, 350);
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
    this.clearSearchDebounce();
    this.showSearchSuggestions = false;
    this.loadProducts();
  }

  selectSuggestion(product: Product): void {
    this.filters.search = product.name;
    this.showSearchSuggestions = false;
    this.searchSuggestions = [];
    this.loadProducts();
  }

  clearFilters(): void {
    this.filters = {
      search: '',
      brand: 'all',
      sort: 'featured',
      minPrice: null,
      maxPrice: null,
      inStock: false,
    };
    this.searchSuggestions = [];
    this.showSearchSuggestions = false;
    this.currentPage = 1;
    this.loadProducts();
  }

  toggleWishlist(product: Product): void {
    const wasWishlisted = this.isWishlisted(product.id);
    this.wishlistService.toggle(product);
    this.ownerActionMessage = wasWishlisted
      ? 'تمت إزالة المنتج من المفضلة.'
      : 'تمت إضافة المنتج إلى المفضلة.';
  }

  isWishlisted(productId: string): boolean {
    return this.wishlistIds.has(productId);
  }

  trackByProduct(_index: number, item: Product): string {
    return item.id;
  }

  setSection(section: 'all' | 'laptops' | 'accessories'): void {
    this.selectedSection = section;
    this.currentPage = 1;
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    const productsSection = document.getElementById('products');
    productsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  get paginatedProducts(): Product[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sectionProducts.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.sectionProducts.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  get sectionProducts(): Product[] {
    if (this.selectedSection === 'all') {
      return this.products;
    }

    if (this.selectedSection === 'accessories') {
      return [];
    }

    return this.products.filter((product) =>
      this.selectedSection === 'laptops' ? this.isLaptopCategory(product.category) : false
    );
  }

  get recentlyViewedProducts(): Product[] {
    return this.recentlyViewed;
  }

  resolveProductImage(product: Product): string {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images[0];
    }

    if (product.image) {
      return product.image;
    }

    return 'assets/images/laptop-placeholder.svg';
  }

  getDiscountPercent(product: Product): number {
    if (!product.oldPrice || product.oldPrice <= product.price) {
      return 0;
    }

    return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
  }

  isOutOfStock(product: Product): boolean {
    return Number(product.stock) <= 0;
  }

  private isLaptopCategory(category: string): boolean {
    const normalizedCategory = String(category || '').trim().toLowerCase();
    return (
      normalizedCategory.includes('laptop') ||
      normalizedCategory.includes('لاب') ||
      normalizedCategory.includes('notebook')
    );
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

  private clearSearchDebounce(): void {
    if (!this.searchDebounceTimer) {
      return;
    }

    window.clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = null;
  }
}
