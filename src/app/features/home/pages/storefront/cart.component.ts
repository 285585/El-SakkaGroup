import { Component } from '@angular/core';
import { CartItem } from '../../models/store.models';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
})
export class CartComponent {
  constructor(private readonly cartService: CartService) {}

  get cartItems(): CartItem[] {
    return this.cartService.getItems();
  }

  get cartItemsCount(): number {
    return this.cartService.getCount();
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

  resolveProductImage(item: CartItem): string {
    if (Array.isArray(item.product.images) && item.product.images.length > 0) {
      return item.product.images[0];
    }
    return item.product.image || 'assets/images/laptop-placeholder.svg';
  }

  trackByCartItem(_index: number, item: CartItem): string {
    return item.product.id;
  }
}
