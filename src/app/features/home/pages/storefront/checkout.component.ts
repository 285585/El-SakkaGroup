import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { CreateOrderRequest, SavedPaymentCard } from '../../models/store.models';
import { CartService } from '../../services/cart.service';
import { OwnerAuthService } from '../../services/owner-auth.service';
import { StoreApiService } from '../../services/store-api.service';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
})
export class CheckoutComponent implements OnInit {
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

  paymentMethod: 'cash_on_delivery' | 'card' = 'cash_on_delivery';
  selectedSavedCardId = '';
  saveCard = false;
  cardHolderName = '';
  cardNumber = '';
  cardExpiryMonth: number | null = null;
  cardExpiryYear: number | null = null;
  cardCvv = '';

  savedCards: SavedPaymentCard[] = [];
  isLoadingCards = false;
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly cartService: CartService,
    private readonly ownerAuthService: OwnerAuthService,
    private readonly storeApiService: StoreApiService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    if (this.cartService.getItems().length === 0) {
      this.router.navigate(['/cart']);
      return;
    }

    this.ownerAuthService.isSessionValid().subscribe((isValid) => {
      if (!isValid) {
        this.ownerAuthService.logout('/login');
      }
    });

    const user = this.ownerAuthService.getCurrentUser();
    if (user?.email) {
      this.email = user.email;
    }
    if (user?.username) {
      this.customerName = user.username;
    }

    this.loadSavedCards();
  }

  get cartSubtotal(): number {
    return this.cartService.getSubtotal();
  }

  get shippingCost(): number {
    return this.cartService.getShippingCost();
  }

  get cartTotal(): number {
    return this.cartService.getTotal();
  }

  get hasSavedCards(): boolean {
    return this.savedCards.length > 0;
  }

  submitOrder(): void {
    this.errorMessage = '';
    this.successMessage = '';

    const token = this.ownerAuthService.getToken();
    if (!token) {
      this.errorMessage = 'لازم تسجل الدخول أولاً قبل إتمام الدفع.';
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

    if (this.paymentMethod === 'card') {
      const usingSavedCard = Boolean(this.selectedSavedCardId);
      if (!usingSavedCard) {
        if (
          !this.cardHolderName ||
          !this.cardNumber ||
          !this.cardExpiryMonth ||
          !this.cardExpiryYear ||
          !this.cardCvv
        ) {
          this.errorMessage = 'من فضلك أكمل بيانات البطاقة.';
          return;
        }
      }
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
      paymentMethod: this.paymentMethod,
      savedCardId: this.paymentMethod === 'card' && this.selectedSavedCardId
        ? this.selectedSavedCardId
        : undefined,
      saveCard: this.paymentMethod === 'card' ? this.saveCard : false,
      cardHolderName: this.paymentMethod === 'card' ? this.cardHolderName.trim() : undefined,
      cardNumber: this.paymentMethod === 'card' ? this.cardNumber.trim() : undefined,
      cardExpiryMonth: this.paymentMethod === 'card' ? Number(this.cardExpiryMonth) : undefined,
      cardExpiryYear: this.paymentMethod === 'card' ? Number(this.cardExpiryYear) : undefined,
      cardCvv: this.paymentMethod === 'card' ? this.cardCvv.trim() : undefined,
      items: this.cartService.getItems().map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
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

  deleteSavedCard(card: SavedPaymentCard): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.storeApiService.deletePaymentCard(card.id, token).subscribe({
      next: () => {
        this.savedCards = this.savedCards.filter((entry) => entry.id !== card.id);
        if (this.selectedSavedCardId === card.id) {
          this.selectedSavedCardId = '';
        }
      },
    });
  }

  private loadSavedCards(): void {
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
          this.savedCards = cards;
          if (cards.length > 0) {
            this.selectedSavedCardId = cards[0].id;
          }
        },
        error: () => {
          this.savedCards = [];
        },
      });
  }
}
