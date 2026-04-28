import { Component } from '@angular/core';
import { CartItem } from '../../models/store.models';
import { CartService } from '../../services/cart.service';
import { PUBLIC_CONTACT_FOR_PRICING } from '../../constants/public-pricing.message';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
})
export class CartComponent {
  readonly publicPricingHint = PUBLIC_CONTACT_FOR_PRICING;

  constructor(private readonly cartService: CartService) {}

  get cartItems(): CartItem[] {
    return this.cartService.getItems();
  }

  get cartItemsCount(): number {
    return this.cartService.getCount();
  }

  increaseQuantity(item: CartItem): void {
    this.cartService.increase(item.product.id);
  }

  decreaseQuantity(item: CartItem): void {
    this.cartService.decrease(item.product.id);
  }

  removeFromCart(productId: string): void {
    this.cartService.remove(productId);
  }

  clearCart(): void {
    this.cartService.clear();
  }

  trackByCartItem(_index: number, item: CartItem): string {
    return item.product.id;
  }
}
