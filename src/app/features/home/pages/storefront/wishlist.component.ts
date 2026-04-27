import { Component } from '@angular/core';
import { Product } from '../../models/store.models';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';

@Component({
  selector: 'app-wishlist',
  templateUrl: './wishlist.component.html',
  styleUrls: ['./wishlist.component.scss'],
})
export class WishlistComponent {
  constructor(
    private readonly wishlistService: WishlistService,
    private readonly cartService: CartService
  ) {}

  get wishlistItems(): Product[] {
    return this.wishlistService.getItems();
  }

  removeFromWishlist(productId: string): void {
    this.wishlistService.remove(productId);
  }

  addToCart(product: Product): void {
    this.cartService.addProduct(product);
  }

  trackByProduct(_index: number, product: Product): string {
    return product.id;
  }
}
