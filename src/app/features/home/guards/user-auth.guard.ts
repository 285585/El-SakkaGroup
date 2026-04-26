import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, map } from 'rxjs';
import { OwnerAuthService } from '../services/owner-auth.service';

@Injectable({
  providedIn: 'root',
})
export class UserAuthGuard implements CanActivate {
  constructor(
    private readonly ownerAuthService: OwnerAuthService,
    private readonly router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.ownerAuthService.isSessionValid().pipe(
      map((isValid) => (isValid ? true : this.router.createUrlTree(['/login'])))
    );
  }
}
