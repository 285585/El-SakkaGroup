import { Component, OnInit } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthUser } from 'src/app/features/home/models/store.models';
import { CartService } from 'src/app/features/home/services/cart.service';
import { OwnerAuthService } from 'src/app/features/home/services/owner-auth.service';
import { WishlistService } from 'src/app/features/home/services/wishlist.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit {
  ownerMode$!: Observable<boolean>;
  currentUser$!: Observable<AuthUser | null>;
  isAuthenticated$!: Observable<boolean>;
  cartItemsCount$!: Observable<number>;
  wishlistCount$!: Observable<number>;

  constructor(
    private readonly ownerAuthService: OwnerAuthService,
    private readonly cartService: CartService,
    private readonly wishlistService: WishlistService
  ) {}

  ngOnInit(): void {
    this.ownerMode$ = this.ownerAuthService.ownerMode$;
    this.currentUser$ = this.ownerAuthService.currentUser$;
    this.isAuthenticated$ = this.ownerAuthService.isAuthenticated$;
    this.cartItemsCount$ = this.cartService.cart$.pipe(
      map((items) => items.reduce((sum, item) => sum + item.quantity, 0))
    );
    this.wishlistCount$ = this.wishlistService.wishlist$.pipe(map((items) => items.length));
    this.ownerAuthService.isSessionValid().subscribe();
  }

  logout(): void {
    this.ownerAuthService.logout();
  }
}
