import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AvailabilityService, BusinessAvailability, CreateAvailabilityRequest } from '../services/availability.service';

@Component({
  selector: 'app-admin-availability',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-availability.html',
  styleUrls: ['./admin-availability.scss']
})
export class AdminAvailabilityComponent implements OnInit {
  availabilities: BusinessAvailability[] = [];
  loading = false;
  error = '';
  
  // Form state
  showModal = false;
  editingAvailability: BusinessAvailability | null = null;
  
  // Modern modal states
  showConfirmModal = false;
  showErrorModal = false;
  showSuccessModal = false;
  modalTitle = '';
  modalMessage = '';
  confirmCallback: (() => void) | null = null;
  availabilityForm: CreateAvailabilityRequest = {
    date: '',
    is_full_day: false,
    unavailable_time_slots: [],
    reason: ''
  };
  
  // All possible time slots
  private allTimeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00'
  ];

  // Weekday time slots (4pm-8pm)
  private weekdayTimeSlots = [
    '16:00', '17:00', '18:00', '19:00', '20:00'
  ];

  // Weekend time slots (8am-8pm)  
  private weekendTimeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00'
  ];
  
  // Calendar view
  currentMonth = new Date();
  calendarDates: Date[] = [];

  constructor(private availabilityService: AvailabilityService) {}

  // Helper function to format date as YYYY-MM-DD without timezone conversion
  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnInit() {
    this.loadAvailabilities();
    this.generateCalendarDates();
  }

  loadAvailabilities() {
    this.loading = true;
    this.error = '';
    
    // Get current month's start and end dates using local timezone
    const startDate = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const endDate = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
    
    // Format dates without timezone conversion
    const startDateStr = this.formatDateLocal(startDate);
    const endDateStr = this.formatDateLocal(endDate);
    
    this.availabilityService.getAvailabilities(startDateStr, endDateStr).subscribe({
      next: (data) => {
        this.availabilities = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load availability restrictions';
        this.loading = false;
        console.error(err);
      }
    });
  }

  generateCalendarDates() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from the first day of the week containing the first day of the month
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());
    
    this.calendarDates = [];
    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      this.calendarDates.push(date);
    }
  }

  previousMonth() {
    this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
    this.generateCalendarDates();
    this.loadAvailabilities();
  }

  nextMonth() {
    this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
    this.generateCalendarDates();
    this.loadAvailabilities();
  }

  getAvailabilityForDate(date: Date): BusinessAvailability | null {
    // Use local date string to avoid timezone conversion issues
    const localDateStr = this.formatDateLocal(date);
    
    return this.availabilities.find(a => 
      a.date.split('T')[0] === localDateStr
    ) || null;
  }

  isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.currentMonth.getMonth();
  }

  isPastDate(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  openAddModal(selectedDate?: Date) {
    this.editingAvailability = null;
    
    this.availabilityForm = {
      date: selectedDate ? this.formatDateLocal(selectedDate) : '',
      is_full_day: false,
      unavailable_time_slots: [],
      reason: ''
    };
    this.showModal = true;
  }

  openEditModal(availability: BusinessAvailability) {
    this.editingAvailability = availability;
    this.availabilityForm = {
      date: availability.date.split('T')[0],
      is_full_day: availability.is_full_day,
      unavailable_time_slots: [...availability.unavailable_time_slots],
      reason: availability.reason
    };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingAvailability = null;
  }

  onTimeSlotChange(timeSlot: string, event: any) {
    if (event.target.checked) {
      if (!this.availabilityForm.unavailable_time_slots.includes(timeSlot)) {
        this.availabilityForm.unavailable_time_slots.push(timeSlot);
      }
    } else {
      this.availabilityForm.unavailable_time_slots = 
        this.availabilityForm.unavailable_time_slots.filter(slot => slot !== timeSlot);
    }
  }

  isTimeSlotSelected(timeSlot: string): boolean {
    return this.availabilityForm.unavailable_time_slots.includes(timeSlot);
  }

  onFullDayChange() {
    if (this.availabilityForm.is_full_day) {
      this.availabilityForm.unavailable_time_slots = [];
    }
  }

  onDateChange() {
    // Clear time slots that are no longer valid for the selected date
    const availableSlots = this.getAvailableTimeSlotsForModal();
    this.availabilityForm.unavailable_time_slots = 
      this.availabilityForm.unavailable_time_slots.filter(slot => 
        availableSlots.includes(slot)
      );
  }

  saveAvailability() {
    if (!this.availabilityForm.date) {
      this.showError('Validation Error', 'Please select a date');
      return;
    }

    if (!this.availabilityForm.is_full_day && this.availabilityForm.unavailable_time_slots.length === 0) {
      this.showError('Validation Error', 'Please select time slots or mark as full day unavailable');
      return;
    }

    const request = this.editingAvailability 
      ? this.availabilityService.updateAvailability(this.editingAvailability._id, this.availabilityForm)
      : this.availabilityService.createAvailability(this.availabilityForm);

    request.subscribe({
      next: () => {
        const action = this.editingAvailability ? 'updated' : 'created';
        this.showSuccess('Success', `Availability restriction ${action} successfully`);
        this.loadAvailabilities();
        this.closeModal();
      },
      error: (err) => {
        this.showError('Error', err.error?.error || 'Failed to save availability restriction');
        console.error(err);
      }
    });
  }

  deleteAvailability(availability: BusinessAvailability) {
    const message = `Are you sure you want to delete the availability restriction for ${this.formatDate(availability.date)}?`;
    this.showConfirmation('Confirm Deletion', message, () => {
      this.availabilityService.deleteAvailability(availability._id).subscribe({
        next: () => {
          this.showSuccess('Success', 'Availability restriction deleted successfully');
          this.loadAvailabilities();
        },
        error: (err) => {
          this.showError('Error', 'Failed to delete availability restriction');
          console.error(err);
        }
      });
    });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  formatTime(time: string): string {
    if (!time) return '';
    
    try {
      const [hours, minutes] = time.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return time; // fallback to original string
      
      const date = new Date();
      date.setHours(hours, minutes);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
    } catch (error) {
      console.error('Error formatting time:', time, error);
      return time; // fallback to original string
    }
  }

  getMonthYear(): string {
    return this.currentMonth.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  }

  getWeekdays(): string[] {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }

  getMinDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  getAvailableTimeSlotsForModal(): string[] {
    if (!this.availabilityForm.date) {
      console.log('No date selected, returning empty array');
      return [];
    }
    
    const selectedDate = new Date(this.availabilityForm.date);
    const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
    const slots = isWeekend ? this.weekendTimeSlots : this.weekdayTimeSlots;
    
    console.log('Available time slots for modal:', {
      date: this.availabilityForm.date,
      isWeekend,
      slots
    });
    
    return slots;
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
  }

  isSelectedDateWeekend(): boolean {
    if (!this.availabilityForm.date) return false;
    const selectedDate = new Date(this.availabilityForm.date);
    return this.isWeekend(selectedDate);
  }

  // Modern modal methods
  showError(title: string, message: string): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.showErrorModal = true;
  }

  showSuccess(title: string, message: string): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.showSuccessModal = true;
  }

  showConfirmation(title: string, message: string, callback: () => void): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.confirmCallback = callback;
    this.showConfirmModal = true;
  }

  closeModals(): void {
    this.showConfirmModal = false;
    this.showErrorModal = false;
    this.showSuccessModal = false;
    this.confirmCallback = null;
  }

  confirmAction(): void {
    if (this.confirmCallback) {
      this.confirmCallback();
    }
    this.closeModals();
  }
}