import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';
import {
  OrderStatus,
  SaveCardRequest,
  SavedPaymentCard,
  UserOrder,
} from '../../models/store.models';
import { OwnerAuthService } from '../../services/owner-auth.service';
import { StoreApiService } from '../../services/store-api.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  orders: UserOrder[] = [];
  cards: SavedPaymentCard[] = [];
  activeTab: 'orders' | 'delivered' | 'returned' | 'cards' = 'orders';

  isLoadingOrders = false;
  isLoadingCards = false;
  isSavingCard = false;
  editingCardId: string | null = null;

  cardHolderName = '';
  cardNumber = '';
  expiryMonth: number | null = null;
  expiryYear: number | null = null;

  errorMessage = '';
  successMessage = '';

  readonly orderStatusLabelMap: Record<OrderStatus, string> = {
    pending: 'قيد المراجعة',
    confirmed: 'تم التأكيد',
    shipped: 'جاري الشحن',
    delivered: 'تم التوصيل',
    returned: 'مرتجع',
  };

  constructor(
    private readonly ownerAuthService: OwnerAuthService,
    private readonly storeApiService: StoreApiService
  ) {}

  ngOnInit(): void {
    this.ownerAuthService.isSessionValid().subscribe((isValid) => {
      if (!isValid) {
        this.ownerAuthService.logout('/login');
        return;
      }

      this.loadOrders();
      this.loadCards();
    });
  }

  get userName(): string {
    return this.ownerAuthService.getCurrentUser()?.username || '';
  }

  get userEmail(): string {
    return this.ownerAuthService.getCurrentUser()?.email || '';
  }

  get allOrders(): UserOrder[] {
    return this.orders.filter((order) => order.status !== 'delivered' && order.status !== 'returned');
  }

  get deliveredOrders(): UserOrder[] {
    return this.orders.filter((order) => order.status === 'delivered');
  }

  get returnedOrders(): UserOrder[] {
    return this.orders.filter((order) => order.status === 'returned');
  }

  setTab(tab: 'orders' | 'delivered' | 'returned' | 'cards'): void {
    this.activeTab = tab;
  }

  submitCard(): void {
    this.errorMessage = '';
    this.successMessage = '';
    const token = this.ownerAuthService.getToken();

    if (!token) {
      this.errorMessage = 'انتهت الجلسة. سجل الدخول مرة أخرى.';
      return;
    }

    if (!this.cardHolderName || !this.cardNumber || !this.expiryMonth || !this.expiryYear) {
      this.errorMessage = 'من فضلك أكمل بيانات البطاقة.';
      return;
    }

    const payload: SaveCardRequest = {
      cardHolderName: this.cardHolderName.trim(),
      cardNumber: this.cardNumber.replace(/\s+/g, ''),
      expiryMonth: Number(this.expiryMonth),
      expiryYear: Number(this.expiryYear),
    };

    this.isSavingCard = true;
    const request$ = this.editingCardId
      ? this.storeApiService.updatePaymentCard(this.editingCardId, payload, token)
      : this.storeApiService.savePaymentCard(payload, token);

    request$
      .pipe(finalize(() => (this.isSavingCard = false)))
      .subscribe({
        next: () => {
          this.successMessage = this.editingCardId ? 'تم تحديث البطاقة بنجاح.' : 'تم إضافة البطاقة بنجاح.';
          this.resetCardForm();
          this.loadCards();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveErrorMessage(error, 'تعذر حفظ البطاقة.');
        },
      });
  }

  editCard(card: SavedPaymentCard): void {
    this.editingCardId = card.id;
    this.cardHolderName = card.cardHolderName;
    this.cardNumber = '';
    this.expiryMonth = card.expiryMonth;
    this.expiryYear = card.expiryYear;
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelCardEdit(): void {
    this.resetCardForm();
  }

  deleteCard(cardId: string): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.storeApiService.deletePaymentCard(cardId, token).subscribe({
      next: () => {
        this.successMessage = 'تم حذف البطاقة.';
        this.cards = this.cards.filter((entry) => entry.id !== cardId);
        if (this.editingCardId === cardId) {
          this.resetCardForm();
        }
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage = this.resolveErrorMessage(error, 'تعذر حذف البطاقة.');
      },
    });
  }

  resolveStatusLabel(status: OrderStatus): string {
    return this.orderStatusLabelMap[status] || status;
  }

  private loadOrders(): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.isLoadingOrders = true;
    this.storeApiService
      .getUserOrders(token)
      .pipe(finalize(() => (this.isLoadingOrders = false)))
      .subscribe({
        next: (orders) => {
          this.orders = orders.map((order) => ({
            ...order,
            status: (order.status || 'pending') as OrderStatus,
          }));
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveErrorMessage(error, 'تعذر تحميل الطلبات.');
        },
      });
  }

  private loadCards(): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.isLoadingCards = true;
    this.storeApiService
      .getSavedCards(token)
      .pipe(finalize(() => (this.isLoadingCards = false)))
      .subscribe({
        next: (cards) => {
          this.cards = cards;
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveErrorMessage(error, 'تعذر تحميل البطاقات.');
        },
      });
  }

  private resetCardForm(): void {
    this.editingCardId = null;
    this.cardHolderName = '';
    this.cardNumber = '';
    this.expiryMonth = null;
    this.expiryYear = null;
  }

  private resolveErrorMessage(error: HttpErrorResponse, fallback: string): string {
    if (error.status === 0) {
      return 'تعذر الوصول للسيرفر. تأكد من تشغيل API.';
    }

    if (typeof error.error?.message === 'string' && error.error.message.trim()) {
      return error.error.message;
    }

    return fallback;
  }
}
