import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { OwnerAuthService } from '../../services/owner-auth.service';
import { OwnerDecision, SellRequest, UserInboxMessage } from '../../models/store.models';
import { StoreApiService } from '../../services/store-api.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit, OnDestroy {
  activeTab: 'account' | 'mailbox' | 'sell' = 'account';
  inboxMessages: UserInboxMessage[] = [];
  sellRequests: SellRequest[] = [];

  sellName = '';
  sellBrand = '';
  sellCpu = '';
  sellRam = '';
  sellStorage = '';
  sellGpu = '';
  sellCondition = '';
  sellExpectedPrice: number | null = null;
  sellDescription = '';
  sellImageFiles: File[] = [];
  sellImagePreviewUrls: string[] = [];
  private sellImageObjectUrls: string[] = [];

  isLoadingInbox = false;
  isLoadingSellRequests = false;
  isSubmittingSellRequest = false;
  isMarkingMessageId = '';
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly ownerAuthService: OwnerAuthService,
    private readonly storeApiService: StoreApiService
  ) {}

  ngOnInit(): void {
    this.ownerAuthService.isSessionValid().subscribe((isValid) => {
      if (!isValid) {
        this.ownerAuthService.logout('/login');
        return;
      }

      this.loadInbox();
      this.loadSellRequests();
    });
  }

  ngOnDestroy(): void {
    this.clearSellImagePreviews();
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

  setTab(tab: 'account' | 'mailbox' | 'sell'): void {
    this.activeTab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    if (tab === 'mailbox') {
      this.loadInbox();
    }
    if (tab === 'sell') {
      this.loadSellRequests();
    }
  }

  onSellImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (files.length === 0) {
      return;
    }

    const hasInvalid = files.some((file) => !file.type.startsWith('image/'));
    if (hasInvalid) {
      this.errorMessage = 'يجب اختيار صور فقط.';
      return;
    }

    this.sellImageFiles = files;
    this.clearSellImagePreviews();
    this.sellImageObjectUrls = files.map((file) => URL.createObjectURL(file));
    this.sellImagePreviewUrls = [...this.sellImageObjectUrls];
  }

  submitSellRequest(): void {
    this.errorMessage = '';
    this.successMessage = '';
    const token = this.ownerAuthService.getToken();
    if (!token) {
      this.errorMessage = 'انتهت الجلسة. سجل الدخول مرة أخرى.';
      return;
    }

    if (
      !this.sellName ||
      !this.sellBrand ||
      !this.sellCpu ||
      !this.sellRam ||
      !this.sellStorage ||
      !this.sellCondition ||
      !this.sellExpectedPrice ||
      this.sellExpectedPrice <= 0
    ) {
      this.errorMessage = 'من فضلك أكمل بيانات اللاب المطلوب بيعه.';
      return;
    }

    if (this.sellImageFiles.length === 0) {
      this.errorMessage = 'من فضلك ارفع صورة واحدة على الأقل للاب.';
      return;
    }

    const formData = new FormData();
    formData.append('name', this.sellName.trim());
    formData.append('brand', this.sellBrand.trim());
    formData.append('cpu', this.sellCpu.trim());
    formData.append('ram', this.sellRam.trim());
    formData.append('storage', this.sellStorage.trim());
    formData.append('gpu', this.sellGpu.trim());
    formData.append('condition', this.sellCondition.trim());
    formData.append('expectedPrice', String(this.sellExpectedPrice));
    formData.append('description', this.sellDescription.trim());
    this.sellImageFiles.forEach((file) => {
      formData.append('images', file);
    });

    this.isSubmittingSellRequest = true;
    this.storeApiService
      .createSellRequest(formData, token)
      .pipe(finalize(() => (this.isSubmittingSellRequest = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'تم إرسال طلب بيع اللاب بنجاح للمالك.';
          this.resetSellForm();
          this.loadSellRequests();
          this.loadInbox();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveErrorMessage(error, 'تعذر إرسال طلب البيع.');
        },
      });
  }

  markMessageAsRead(message: UserInboxMessage): void {
    if (message.isRead) {
      return;
    }

    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.isMarkingMessageId = message.id;
    this.storeApiService
      .markInboxAsRead(message.id, token)
      .pipe(finalize(() => (this.isMarkingMessageId = '')))
      .subscribe({
        next: ({ inboxMessage }) => {
          this.inboxMessages = this.inboxMessages.map((entry) =>
            entry.id === inboxMessage.id ? inboxMessage : entry
          );
        },
      });
  }

  resolveDecisionLabel(decision: OwnerDecision): string {
    if (decision === 'approved') {
      return 'تمت الموافقة';
    }
    if (decision === 'rejected') {
      return 'مرفوض';
    }
    return 'قيد المراجعة';
  }

  private loadInbox(): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.isLoadingInbox = true;
    this.storeApiService
      .getUserInbox(token)
      .pipe(finalize(() => (this.isLoadingInbox = false)))
      .subscribe({
        next: (messages) => {
          this.inboxMessages = messages;
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveErrorMessage(error, 'تعذر تحميل البريد.');
        },
      });
  }

  private loadSellRequests(): void {
    const token = this.ownerAuthService.getToken();
    if (!token) {
      return;
    }

    this.isLoadingSellRequests = true;
    this.storeApiService
      .getUserSellRequests(token)
      .pipe(finalize(() => (this.isLoadingSellRequests = false)))
      .subscribe({
        next: (requests) => {
          this.sellRequests = requests;
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveErrorMessage(error, 'تعذر تحميل طلبات البيع.');
        },
      });
  }

  private resetSellForm(): void {
    this.sellName = '';
    this.sellBrand = '';
    this.sellCpu = '';
    this.sellRam = '';
    this.sellStorage = '';
    this.sellGpu = '';
    this.sellCondition = '';
    this.sellExpectedPrice = null;
    this.sellDescription = '';
    this.sellImageFiles = [];
    this.clearSellImagePreviews();
  }

  private clearSellImagePreviews(): void {
    this.sellImageObjectUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    this.sellImageObjectUrls = [];
    this.sellImagePreviewUrls = [];
  }

  private resolveErrorMessage(error: HttpErrorResponse, fallbackMessage: string): string {
    if (error.status === 0) {
      return 'تعذر الوصول للسيرفر. تأكد من تشغيل API.';
    }

    if (typeof error.error?.message === 'string' && error.error.message.trim()) {
      return error.error.message;
    }

    return fallbackMessage;
  }
}
