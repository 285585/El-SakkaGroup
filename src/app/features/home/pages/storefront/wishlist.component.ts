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

  resolveProductImage(product: Product): string {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images[0];
    }

    return product.image || 'assets/images/laptop-placeholder.svg';
  }

  trackByProduct(_index: number, product: Product): string {
    return product.id;
  }
}
