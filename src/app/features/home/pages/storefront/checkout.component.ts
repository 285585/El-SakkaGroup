import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { CreateOrderRequest } from '../../models/store.models';
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
    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    if (fullName) {
      this.customerName = fullName;
    } else if (user?.username) {
      this.customerName = user.username;
    }
    if (user?.phone) {
      this.phone = user.phone;
    }
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
}
