import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { OwnerAuthService } from '../../services/owner-auth.service';

@Component({
  selector: 'app-owner-login',
  templateUrl: './owner-login.component.html',
  styleUrls: ['./owner-login.component.scss'],
})
export class OwnerLoginComponent implements OnInit {
  username = '';
  password = '';
  isSubmitting = false;
  errorMessage = '';

  constructor(
    private readonly ownerAuthService: OwnerAuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.ownerAuthService.isSessionValid().subscribe((isValid) => {
      if (isValid) {
        this.router.navigate(['/owner/dashboard']);
      }
    });
  }

  submit(): void {
    this.errorMessage = '';

    if (!this.username || !this.password) {
      this.errorMessage = 'من فضلك أدخل اسم المستخدم وكلمة المرور.';
      return;
    }

    this.isSubmitting = true;

    this.ownerAuthService
      .login(this.username.trim(), this.password)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.router.navigate(['/owner/dashboard']);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 401) {
            this.errorMessage = 'بيانات الدخول غير صحيحة.';
            return;
          }

          this.errorMessage = 'تعذر الوصول للسيرفر. تأكد من تشغيل npm run api ثم حاول مرة أخرى.';
        },
      });
  }
}
