import { Component, OnInit } from '@angular/core';
import { OwnerAuthService } from '../../services/owner-auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  constructor(private readonly ownerAuthService: OwnerAuthService) {}

  ngOnInit(): void {
    this.ownerAuthService.isSessionValid().subscribe((isValid) => {
      if (!isValid) {
        this.ownerAuthService.logout('/login');
      }
    });
  }

  get userName(): string {
    return this.ownerAuthService.getCurrentUser()?.username || '';
  }

  get userEmail(): string {
    return this.ownerAuthService.getCurrentUser()?.email || '';
  }

  get userPhone(): string {
    return this.ownerAuthService.getCurrentUser()?.phone || '';
  }
}
