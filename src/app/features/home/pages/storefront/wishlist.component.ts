import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Product } from '../../models/store.models';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { PUBLIC_CONTACT_FOR_PRICING } from '../../constants/public-pricing.message';

@Component({
  selector: 'app-wishlist',
  templateUrl: './wishlist.component.html',
  styleUrls: ['./wishlist.component.scss'],
})
export class WishlistComponent {
  readonly publicPricingHint = PUBLIC_CONTACT_FOR_PRICING;

  constructor(
    private readonly wishlistService: WishlistService,
    private readonly cartService: CartService,
    private readonly router: Router
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

  buyNow(product: Product): void {
    if (product.stock <= 0) {
      return;
    }
    this.router.navigate(['/checkout'], { queryParams: { productId: product.id, qty: 1 } });
  }

  trackByProduct(_index: number, product: Product): string {
    return product.id;
  }
}
