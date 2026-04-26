import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { Product } from '../../models/store.models';
import { OwnerAuthService } from '../../services/owner-auth.service';
import { StoreApiService } from '../../services/store-api.service';

@Component({
  selector: 'app-owner-dashboard',
  templateUrl: './owner-dashboard.component.html',
  styleUrls: ['./owner-dashboard.component.scss'],
})
export class OwnerDashboardComponent implements OnInit, OnDestroy {
  editingProductId: string | null = null;
  pendingEditId = '';

  name = '';
  brand = '';
  category = '';
  price: number | null = null;
  oldPrice: number | null = null;
  rating = 4.5;
  stock = 1;
  shortDescription = '';
  cpu = '';
  ram = '';
  storage = '';
  display = '';
  gpu = '';
  warranty = '1 Year';
  isFeatured = false;

  imageFiles: File[] = [];
  imagePreviewUrls: string[] = [];
  private imagePreviewObjectUrls: string[] = [];

  isSubmitting = false;
  isDeletingProductId = '';
  isLoadingProducts = false;
  errorMessage = '';
  successMessage = '';
  createdProductId = '';

  products: Product[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly ownerAuthService: OwnerAuthService,
    private readonly storeApiService: StoreApiService
  ) {}

  ngOnInit(): void {
    this.ownerAuthService.isSessionValid().subscribe((isValid) => {
      if (!isValid) {
        this.errorMessage = 'جلسة المالك انتهت. سجل الدخول مرة أخرى.';
        this.ownerAuthService.logout();
      }
    });

    this.pendingEditId = this.route.snapshot.queryParamMap.get('editId') || '';
    this.loadAdminProducts();
  }

  ngOnDestroy(): void {
    this.clearImagePreviews();
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selectedFiles = Array.from(input.files || []);

    if (selectedFiles.length === 0) {
      return;
    }

    const hasInvalidFile = selectedFiles.some((file) => !file.type.startsWith('image/'));
    if (hasInvalidFile) {
      this.errorMessage = 'الملف المختار يجب أن يكون صورة.';
      return;
    }

    this.imageFiles = selectedFiles;
    this.errorMessage = '';
    this.clearImagePreviews();
    this.imagePreviewObjectUrls = this.imageFiles.map((file) => URL.createObjectURL(file));
    this.imagePreviewUrls = [...this.imagePreviewObjectUrls];
  }

  submitProduct(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.createdProductId = '';

    const token = this.ownerAuthService.getToken();
    if (!token) {
      this.errorMessage = 'انتهت الجلسة، سجل الدخول مرة أخرى.';
      return;
    }

    if (!this.name || !this.brand || !this.category || !this.price || !this.shortDescription) {
      this.errorMessage = 'من فضلك أكمل الحقول الأساسية للمنتج.';
      return;
    }

    if (!this.isEditing && this.imageFiles.length === 0) {
      this.errorMessage = 'من فضلك اختر صورة واحدة على الأقل للمنتج.';
      return;
    }

    const formData = new FormData();
    formData.append('name', this.name.trim());
    formData.append('brand', this.brand.trim());
    formData.append('category', this.category.trim());
    formData.append('price', String(this.price));
    formData.append('oldPrice', String(this.oldPrice || this.price));
    formData.append('rating', String(this.rating));
    formData.append('stock', String(this.stock));
    formData.append('isFeatured', String(this.isFeatured));
    formData.append('shortDescription', this.shortDescription.trim());
    formData.append('cpu', this.cpu.trim());
    formData.append('ram', this.ram.trim());
    formData.append('storage', this.storage.trim());
    formData.append('display', this.display.trim());
    formData.append('gpu', this.gpu.trim());
    formData.append('warranty', this.warranty.trim());
    this.imageFiles.forEach((imageFile) => {
      formData.append('images', imageFile);
    });

    this.isSubmitting = true;

    const request$ = this.isEditing
      ? this.storeApiService.updateProduct(this.editingProductId!, formData, token)
      : this.storeApiService.createProduct(formData, token);

    request$
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (response) => {
          this.successMessage = this.isEditing
            ? 'تم تحديث المنتج بنجاح.'
            : 'تم إضافة المنتج بنجاح.';
          this.createdProductId = response.product.id;
          this.resetForm();
          this.loadAdminProducts();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveOwnerErrorMessage(
            error,
            'فشل حفظ المنتج. تأكد من صحة البيانات.'
          );

          if (error.status === 401) {
            this.ownerAuthService.logout();
          }
        },
      });
  }

  editProduct(product: Product): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.editingProductId = product.id;
    this.createdProductId = product.id;
    this.name = product.name;
    this.brand = product.brand;
    this.category = product.category;
    this.price = product.price;
    this.oldPrice = product.oldPrice;
    this.rating = product.rating;
    this.stock = product.stock;
    this.shortDescription = product.shortDescription;
    this.cpu = product.specs.cpu;
    this.ram = product.specs.ram;
    this.storage = product.specs.storage;
    this.display = product.specs.display;
    this.gpu = product.specs.gpu;
    this.warranty = product.specs.warranty;
    this.isFeatured = product.isFeatured;
    this.imageFiles = [];
    this.clearImagePreviews();
    this.imagePreviewUrls = this.getProductImages(product);
  }

  cancelEdit(): void {
    this.resetForm();
    this.successMessage = 'تم إلغاء وضع التعديل.';
  }

  deleteProduct(product: Product): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      this.errorMessage = 'انتهت الجلسة، سجل الدخول مرة أخرى.';
      return;
    }

    const confirmed = window.confirm(`هل تريد حذف المنتج "${product.name}"؟`);
    if (!confirmed) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isDeletingProductId = product.id;

    this.storeApiService
      .deleteProduct(product.id, token)
      .pipe(finalize(() => (this.isDeletingProductId = '')))
      .subscribe({
        next: () => {
          if (this.editingProductId === product.id) {
            this.resetForm();
          }
          this.successMessage = 'تم حذف المنتج بنجاح.';
          this.loadAdminProducts();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveOwnerErrorMessage(error, 'فشل حذف المنتج.');

          if (error.status === 401) {
            this.ownerAuthService.logout();
          }
        },
      });
  }

  logout(): void {
    this.ownerAuthService.logout();
  }

  trackByProduct(_index: number, product: Product): string {
    return product.id;
  }

  get isEditing(): boolean {
    return Boolean(this.editingProductId);
  }

  private loadAdminProducts(): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.isLoadingProducts = true;

    this.storeApiService
      .getAdminProducts(token)
      .pipe(finalize(() => (this.isLoadingProducts = false)))
      .subscribe({
        next: (products) => {
          this.products = products;
          if (this.pendingEditId) {
            const productToEdit = products.find((product) => product.id === this.pendingEditId);
            if (productToEdit) {
              this.editProduct(productToEdit);
            }

            this.pendingEditId = '';
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { editId: null },
              queryParamsHandling: 'merge',
              replaceUrl: true,
            });
          }
        },
        error: (error: HttpErrorResponse) => {
          this.products = [];

          this.errorMessage = this.resolveOwnerErrorMessage(
            error,
            'تعذر تحميل المنتجات من السيرفر.'
          );

          if (error.status === 401) {
            this.ownerAuthService.logout();
          }
        },
      });
  }

  private resetForm(): void {
    this.editingProductId = null;
    this.name = '';
    this.brand = '';
    this.category = '';
    this.price = null;
    this.oldPrice = null;
    this.rating = 4.5;
    this.stock = 1;
    this.shortDescription = '';
    this.cpu = '';
    this.ram = '';
    this.storage = '';
    this.display = '';
    this.gpu = '';
    this.warranty = '1 Year';
    this.isFeatured = false;
    this.imageFiles = [];
    this.clearImagePreviews();
  }

  private clearImagePreviews(): void {
    this.imagePreviewObjectUrls.forEach((previewUrl) => {
      URL.revokeObjectURL(previewUrl);
    });
    this.imagePreviewObjectUrls = [];
    this.imagePreviewUrls = [];
  }

  private getProductImages(product: Product): string[] {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images;
    }

    return product.image ? [product.image] : [];
  }

  private resolveOwnerErrorMessage(error: HttpErrorResponse, fallbackMessage: string): string {
    if (error.status === 0) {
      return 'تعذر الوصول للسيرفر. تأكد من تشغيل npm run api.';
    }

    if (error.status === 401) {
      return 'جلسة المالك انتهت أو بيانات الدخول غير صالحة. سجل الدخول مرة أخرى.';
    }

    if (typeof error.error?.message === 'string' && error.error.message.trim()) {
      return error.error.message;
    }

    return fallbackMessage;
  }
}
