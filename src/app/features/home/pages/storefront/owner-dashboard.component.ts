import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import {
  AdminOrder,
  AdminUser,
  OrderStatus,
  OwnerDecision,
  Product,
  OwnerCommunication,
  SellRequest,
} from '../../models/store.models';
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
  stock = 1;
  shortDescription = '';
  cpu = '';
  ram = '';
  storage = '';
  display = '';
  gpu = '';
  isFeatured = false;

  imageFiles: File[] = [];
  imagePreviewUrls: string[] = [];
  private imagePreviewObjectUrls: string[] = [];

  isSubmitting = false;
  isDeletingProductId = '';
  isLoadingProducts = false;
  isLoadingOrders = false;
  isLoadingSellRequests = false;
  isLoadingUsers = false;
  isLoadingCommunications = false;
  isUpdatingOrderId = '';
  isDecidingOrderId = '';
  isDeletingOrderId = '';
  isDecidingSellRequestId = '';
  isDeletingSellRequestId = '';
  isDeletingUserId = '';
  isDeletingCommunicationId = '';
  errorMessage = '';
  successMessage = '';
  createdProductId = '';

  products: Product[] = [];
  orders: AdminOrder[] = [];
  sellRequests: SellRequest[] = [];
  users: AdminUser[] = [];
  ownerCommunications: OwnerCommunication[] = [];
  orderReplyDraft: Record<string, string> = {};
  sellReplyDraft: Record<string, string> = {};
  readonly orderStatusOptions: Array<{ value: OrderStatus; label: string }> = [
    { value: 'pending', label: 'قيد المراجعة' },
    { value: 'confirmed', label: 'تم التأكيد' },
    { value: 'shipped', label: 'جاري الشحن' },
    { value: 'delivered', label: 'تم التوصيل' },
    { value: 'returned', label: 'مرتجع' },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly ownerAuthService: OwnerAuthService,
    private readonly storeApiService: StoreApiService
  ) {}

  ngOnInit(): void {
    this.ownerAuthService.isOwnerSessionValid().subscribe((isValid) => {
      if (!isValid) {
        this.errorMessage = 'هذه الصفحة خاصة بالمالك فقط. سجل الدخول بحساب المالك.';
        this.ownerAuthService.logout('/login');
      }
    });

    this.pendingEditId = this.route.snapshot.queryParamMap.get('editId') || '';
    this.loadAdminProducts();
    this.loadAdminOrders();
    this.loadAdminSellRequests();
    this.loadAdminUsers();
    this.loadAdminCommunications();
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
    if (this.oldPrice !== null && this.oldPrice !== undefined && this.oldPrice > 0) {
      formData.append('oldPrice', String(this.oldPrice));
    }
    formData.append('stock', String(this.stock));
    formData.append('isFeatured', String(this.isFeatured));
    formData.append('shortDescription', this.shortDescription.trim());
    formData.append('cpu', this.cpu.trim());
    formData.append('ram', this.ram.trim());
    formData.append('storage', this.storage.trim());
    formData.append('display', this.display.trim());
    formData.append('gpu', this.gpu.trim());
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
    this.stock = product.stock;
    this.shortDescription = product.shortDescription;
    this.cpu = product.specs.cpu;
    this.ram = product.specs.ram;
    this.storage = product.specs.storage;
    this.display = product.specs.display;
    this.gpu = product.specs.gpu;
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

  /** صورة صغيرة لقائمة المنتجات في لوحة المالك */
  getProductListImage(product: Product): string {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images[0];
    }
    return product.image?.trim() ? product.image : '';
  }

  trackByUser(_index: number, user: AdminUser): string {
    return user.id;
  }

  trackByCommunication(_index: number, entry: OwnerCommunication): string {
    return entry.id;
  }

  deleteUser(user: AdminUser): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      this.errorMessage = 'انتهت الجلسة، سجل الدخول مرة أخرى.';
      return;
    }

    const label = user.username || user.email || user.id;
    const confirmed = window.confirm(
      `سيتم حذف الحساب «${label}» نهائياً مع الطلبات وطلبات البيع والرسائل والسلة والتقييمات المرتبطة به. هل أنت متأكد؟`
    );
    if (!confirmed) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isDeletingUserId = user.id;

    this.storeApiService
      .deleteAdminUser(user.id, token)
      .pipe(finalize(() => (this.isDeletingUserId = '')))
      .subscribe({
        next: () => {
          this.users = this.users.filter((entry) => entry.id !== user.id);
          this.successMessage = `تم حذف المستخدم ${label}.`;
          this.loadAdminOrders();
          this.loadAdminSellRequests();
          this.loadAdminCommunications();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveOwnerErrorMessage(error, 'تعذر حذف المستخدم.');
          if (error.status === 401) {
            this.ownerAuthService.logout();
          }
        },
      });
  }

  deleteCommunication(entry: OwnerCommunication): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      this.errorMessage = 'انتهت الجلسة، سجل الدخول مرة أخرى.';
      return;
    }

    const confirmed = window.confirm('هل تريد حذف هذه المراسلة من السجل؟ (تُزال أيضاً من بريد المستخدم إن وُجدت)');
    if (!confirmed) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isDeletingCommunicationId = entry.id;

    this.storeApiService
      .deleteOwnerCommunication(entry.id, token)
      .pipe(finalize(() => (this.isDeletingCommunicationId = '')))
      .subscribe({
        next: () => {
          this.ownerCommunications = this.ownerCommunications.filter((row) => row.id !== entry.id);
          this.successMessage = 'تم حذف المراسلة.';
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveOwnerErrorMessage(error, 'تعذر حذف المراسلة.');
          if (error.status === 401) {
            this.ownerAuthService.logout();
          }
        },
      });
  }

  formatCommunicationKind(kind: string): string {
    if (kind === 'order') {
      return 'طلب شراء';
    }
    if (kind === 'sell_request') {
      return 'طلب بيع';
    }
    return 'عام';
  }

  trackBySellRequest(_index: number, request: SellRequest): string {
    return request.id;
  }

  resolveDecisionLabel(decision: OwnerDecision): string {
    if (decision === 'approved') {
      return 'تمت الموافقة';
    }
    if (decision === 'rejected') {
      return 'مرفوض';
    }
    return 'قيد المراجعة';
  }

  setOrderReplyDraft(orderId: string, value: string): void {
    this.orderReplyDraft[orderId] = value;
  }

  getOrderReplyDraft(orderId: string): string {
    return this.orderReplyDraft[orderId] || '';
  }

  getOrderReplyValue(order: AdminOrder): string {
    if (Object.prototype.hasOwnProperty.call(this.orderReplyDraft, order.id)) {
      return this.orderReplyDraft[order.id] || '';
    }
    return order.ownerReply || '';
  }

  setSellReplyDraft(requestId: string, value: string): void {
    this.sellReplyDraft[requestId] = value;
  }

  getSellReplyDraft(requestId: string): string {
    return this.sellReplyDraft[requestId] || '';
  }

  getSellReplyValue(requestItem: SellRequest): string {
    if (Object.prototype.hasOwnProperty.call(this.sellReplyDraft, requestItem.id)) {
      return this.sellReplyDraft[requestItem.id] || '';
    }
    return requestItem.ownerReply || '';
  }

  updateOrderStatus(order: AdminOrder, nextStatus: OrderStatus): void {
    const token = this.ownerAuthService.getToken();
    if (!token || order.status === nextStatus) {
      return;
    }

    this.isUpdatingOrderId = order.id;
    this.storeApiService
      .updateOrderStatus(order.id, nextStatus, token)
      .pipe(finalize(() => (this.isUpdatingOrderId = '')))
      .subscribe({
        next: ({ order: updatedOrder }) => {
          this.orders = this.orders.map((entry) =>
            entry.id === updatedOrder.id ? updatedOrder : entry
          );
          this.successMessage = `تم تحديث حالة الطلب ${order.id}.`;
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveOwnerErrorMessage(error, 'تعذر تحديث حالة الطلب.');
        },
      });
  }

  updateOrderDecision(order: AdminOrder, decision: 'approved' | 'rejected'): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.isDecidingOrderId = order.id;
    this.storeApiService
      .updateOrderDecision(order.id, decision, this.getOrderReplyDraft(order.id), token)
      .pipe(finalize(() => (this.isDecidingOrderId = '')))
      .subscribe({
        next: ({ order: updatedOrder }) => {
          this.orders = this.orders.map((entry) =>
            entry.id === updatedOrder.id
              ? {
                  ...updatedOrder,
                  status: (updatedOrder.status || 'pending') as OrderStatus,
                  ownerDecision: (updatedOrder.ownerDecision || 'pending') as OwnerDecision,
                }
              : entry
          );
          this.successMessage = `تم تحديث قرار المالك للطلب ${order.id}.`;
          this.loadAdminCommunications();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveOwnerErrorMessage(error, 'تعذر تحديث قرار الطلب.');
        },
      });
  }

  deleteOrder(order: AdminOrder): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    const confirmed = window.confirm(`هل تريد حذف طلب الشراء ${order.id}؟`);
    if (!confirmed) {
      return;
    }

    this.isDeletingOrderId = order.id;
    this.storeApiService
      .deleteOrder(order.id, this.getOrderReplyDraft(order.id), token)
      .pipe(finalize(() => (this.isDeletingOrderId = '')))
      .subscribe({
        next: () => {
          this.orders = this.orders.filter((entry) => entry.id !== order.id);
          this.successMessage = `تم حذف الطلب ${order.id}.`;
          this.loadAdminCommunications();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveOwnerErrorMessage(error, 'تعذر حذف الطلب.');
        },
      });
  }

  updateSellRequestDecision(requestItem: SellRequest, decision: 'approved' | 'rejected'): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.isDecidingSellRequestId = requestItem.id;
    this.storeApiService
      .updateSellRequestDecision(
        requestItem.id,
        decision,
        this.getSellReplyDraft(requestItem.id),
        token
      )
      .pipe(finalize(() => (this.isDecidingSellRequestId = '')))
      .subscribe({
        next: ({ sellRequest }) => {
          this.sellRequests = this.sellRequests.map((entry) =>
            entry.id === sellRequest.id ? sellRequest : entry
          );
          this.successMessage = `تم تحديث قرار طلب البيع ${requestItem.id}.`;
          this.loadAdminCommunications();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveOwnerErrorMessage(error, 'تعذر تحديث قرار طلب البيع.');
        },
      });
  }

  deleteSellRequest(requestItem: SellRequest): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    const confirmed = window.confirm(`هل تريد حذف طلب بيع اللاب ${requestItem.id}؟`);
    if (!confirmed) {
      return;
    }

    this.isDeletingSellRequestId = requestItem.id;
    this.storeApiService
      .deleteSellRequest(requestItem.id, this.getSellReplyDraft(requestItem.id), token)
      .pipe(finalize(() => (this.isDeletingSellRequestId = '')))
      .subscribe({
        next: () => {
          this.sellRequests = this.sellRequests.filter((entry) => entry.id !== requestItem.id);
          this.successMessage = `تم حذف طلب البيع ${requestItem.id}.`;
          this.loadAdminCommunications();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveOwnerErrorMessage(error, 'تعذر حذف طلب البيع.');
        },
      });
  }

  get isEditing(): boolean {
    return Boolean(this.editingProductId);
  }

  get approvedPurchaseOrders(): AdminOrder[] {
    return this.orders.filter(
      (o) => o.ownerDecision === 'approved' && o.status !== 'returned'
    );
  }

  get returnedOrders(): AdminOrder[] {
    return this.orders.filter((o) => o.status === 'returned');
  }

  get approvedSellRequestsList(): SellRequest[] {
    return this.sellRequests.filter((r) => r.decision === 'approved');
  }

  resolveStatusLabel(status: OrderStatus): string {
    return this.orderStatusOptions.find((o) => o.value === status)?.label ?? String(status);
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

  private loadAdminOrders(): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.isLoadingOrders = true;
    this.storeApiService
      .getAdminOrders(token)
      .pipe(finalize(() => (this.isLoadingOrders = false)))
      .subscribe({
        next: (orders) => {
          this.orders = orders.map((order) => ({
            ...order,
            status: (order.status || 'pending') as OrderStatus,
            ownerDecision: (order.ownerDecision || 'pending') as OwnerDecision,
          }));
        },
        error: () => {
          this.orders = [];
        },
      });
  }

  private loadAdminSellRequests(): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.isLoadingSellRequests = true;
    this.storeApiService
      .getAdminSellRequests(token)
      .pipe(finalize(() => (this.isLoadingSellRequests = false)))
      .subscribe({
        next: (requests) => {
          this.sellRequests = requests;
        },
        error: (error: HttpErrorResponse) => {
          this.sellRequests = [];
          this.errorMessage = this.resolveOwnerErrorMessage(error, 'تعذر تحميل طلبات البيع.');
        },
      });
  }

  private loadAdminUsers(): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.isLoadingUsers = true;
    this.storeApiService
      .getAdminUsers(token)
      .pipe(finalize(() => (this.isLoadingUsers = false)))
      .subscribe({
        next: (users) => {
          this.users = users;
        },
        error: (error: HttpErrorResponse) => {
          this.users = [];
          this.errorMessage = this.resolveOwnerErrorMessage(error, 'تعذر تحميل بيانات المستخدمين.');
        },
      });
  }

  private loadAdminCommunications(): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.isLoadingCommunications = true;
    this.storeApiService
      .getAdminCommunications(token)
      .pipe(finalize(() => (this.isLoadingCommunications = false)))
      .subscribe({
        next: (rows) => {
          this.ownerCommunications = rows;
        },
        error: () => {
          this.ownerCommunications = [];
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
    this.stock = 1;
    this.shortDescription = '';
    this.cpu = '';
    this.ram = '';
    this.storage = '';
    this.display = '';
    this.gpu = '';
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
