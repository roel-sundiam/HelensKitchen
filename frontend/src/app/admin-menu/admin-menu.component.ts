import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminMenuService, AdminMenuItem, CreateMenuItemRequest } from '../services/admin-menu.service';
import { ModalService } from '../shared/modal.service';

@Component({
  selector: 'app-admin-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-menu.component.html',
  styleUrls: ['./admin-menu.component.css']
})
export class AdminMenuComponent implements OnInit {
  menuItems: AdminMenuItem[] = [];
  loading = false;
  error = '';
  
  // Add/Edit Menu Item Modal
  showMenuItemModal = false;
  editingMenuItem: AdminMenuItem | null = null;
  menuItemForm: CreateMenuItemRequest = {
    name: '',
    description: '',
    image_url: '',
    images: [],
    base_price: 0
  };

  // Add/Edit Variant Modal
  showVariantModal = false;
  editingVariant: any = null;
  variantForm = {
    name: '',
    price: 0
  };
  selectedMenuItemId = '';

  // Image Upload
  selectedFile: File | null = null;
  uploadingImage = false;


  constructor(
    private adminMenuService: AdminMenuService,
    private modalService: ModalService
  ) {}

  ngOnInit() {
    this.loadMenuItems();
  }

  loadMenuItems() {
    this.loading = true;
    this.error = '';
    
    this.adminMenuService.getMenuItems().subscribe({
      next: (items) => {
        this.menuItems = items;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading menu items:', err);
        this.error = 'Failed to load menu items';
        this.loading = false;
      }
    });
  }

  // Menu Item Management
  openAddMenuItemModal() {
    this.editingMenuItem = null;
    this.menuItemForm = {
      name: '',
      description: '',
      image_url: '',
      images: [],
      base_price: 0
    };
    this.showMenuItemModal = true;
  }

  openEditMenuItemModal(item: AdminMenuItem) {
    this.editingMenuItem = item;
    this.menuItemForm = {
      name: item.name,
      description: item.description,
      image_url: item.image_url,
      images: [...(item.images || [])],
      base_price: item.base_price
    };
    this.showMenuItemModal = true;
  }

  closeMenuItemModal() {
    this.showMenuItemModal = false;
    this.editingMenuItem = null;
    this.selectedFile = null;
  }

  // Check if there are unsaved changes
  hasUnsavedChanges(): boolean {
    return !!(this.menuItemForm.name || this.menuItemForm.description || 
             this.menuItemForm.base_price || 
             (this.menuItemForm.images && this.menuItemForm.images.length > 0) ||
             (this.menuItemForm.image_url && !this.menuItemForm.image_url.includes('data:image/svg+xml')));
  }

  // Handle click outside modal with confirmation
  onModalOverlayClick() {
    console.log('Modal overlay clicked');
    console.log('Current form state:', this.menuItemForm);
    console.log('Has unsaved changes:', this.hasUnsavedChanges());
    
    if (this.hasUnsavedChanges()) {
      console.log('Showing confirmation dialog');
      this.modalService.showConfirm(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to close without saving?',
        'Yes, Close',
        'Keep Editing'
      ).then((confirmed) => {
        console.log('User confirmed:', confirmed);
        if (confirmed) {
          this.closeMenuItemModal();
        }
      });
    } else {
      console.log('No unsaved changes, closing modal');
      this.closeMenuItemModal();
    }
  }

  saveMenuItem() {
    if (!this.menuItemForm.name || !this.menuItemForm.description || !this.menuItemForm.base_price) {
      this.modalService.showAlert('Validation Error', 'Please fill in all required fields.', '⚠️');
      return;
    }

    console.log('Saving menu item with form data:', this.menuItemForm);

    const request = this.editingMenuItem
      ? this.adminMenuService.updateMenuItem(this.editingMenuItem.id, this.menuItemForm)
      : this.adminMenuService.createMenuItem(this.menuItemForm);

    request.subscribe({
      next: (item) => {
        this.modalService.showAlert(
          'Success', 
          `Menu item ${this.editingMenuItem ? 'updated' : 'created'} successfully!`, 
          '✅'
        );
        this.loadMenuItems();
        this.closeMenuItemModal();
      },
      error: (err) => {
        console.error('Error saving menu item:', err);
        this.modalService.showAlert('Error', 'Failed to save menu item', '❌');
      }
    });
  }

  deleteMenuItem(item: AdminMenuItem) {
    this.modalService.showConfirm(
      'Delete Menu Item',
      `Are you sure you want to delete "${item.name}"? This action cannot be undone.`
    ).then((confirmed) => {
      if (confirmed) {
        this.adminMenuService.deleteMenuItem(item.id).subscribe({
          next: () => {
            this.modalService.showAlert('Success', 'Menu item deleted successfully!', '✅');
            this.loadMenuItems();
          },
          error: (err) => {
            console.error('Error deleting menu item:', err);
            const errorMessage = err.error?.error || 'Failed to delete menu item';
            this.modalService.showAlert('Error', errorMessage, '❌');
          }
        });
      }
    });
  }

  // Variant Management
  openAddVariantModal(menuItemId: string) {
    this.selectedMenuItemId = menuItemId;
    this.editingVariant = null;
    this.variantForm = { name: '', price: 0 };
    this.showVariantModal = true;
  }

  openEditVariantModal(variant: any, menuItemId: string) {
    this.selectedMenuItemId = menuItemId;
    this.editingVariant = variant;
    this.variantForm = { name: variant.name, price: variant.price };
    this.showVariantModal = true;
  }

  closeVariantModal() {
    this.showVariantModal = false;
    this.editingVariant = null;
    this.selectedMenuItemId = '';
  }

  // Check if variant form has unsaved changes
  hasUnsavedVariantChanges(): boolean {
    return !!(this.variantForm.name || this.variantForm.price);
  }

  // Handle click outside variant modal with confirmation
  onVariantModalOverlayClick() {
    if (this.hasUnsavedVariantChanges()) {
      this.modalService.showConfirm(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to close without saving?',
        'Yes, Close',
        'Keep Editing'
      ).then((confirmed) => {
        if (confirmed) {
          this.closeVariantModal();
        }
      });
    } else {
      this.closeVariantModal();
    }
  }

  saveVariant() {
    if (!this.variantForm.name || !this.variantForm.price) {
      this.modalService.showAlert('Validation Error', 'Please fill in all fields.', '⚠️');
      return;
    }

    const request = this.editingVariant
      ? this.adminMenuService.updateVariant(this.editingVariant.id, this.variantForm)
      : this.adminMenuService.createVariant(this.selectedMenuItemId, this.variantForm);

    request.subscribe({
      next: () => {
        this.modalService.showAlert(
          'Success', 
          `Variant ${this.editingVariant ? 'updated' : 'created'} successfully!`, 
          '✅'
        );
        this.loadMenuItems();
        this.closeVariantModal();
      },
      error: (err) => {
        console.error('Error saving variant:', err);
        this.modalService.showAlert('Error', 'Failed to save variant', '❌');
      }
    });
  }

  deleteVariant(variant: any) {
    this.modalService.showConfirm(
      'Delete Variant',
      `Are you sure you want to delete "${variant.name}"?`
    ).then((confirmed) => {
      if (confirmed) {
        this.adminMenuService.deleteVariant(variant.id).subscribe({
          next: () => {
            this.modalService.showAlert('Success', 'Variant deleted successfully!', '✅');
            this.loadMenuItems();
          },
          error: (err) => {
            console.error('Error deleting variant:', err);
            const errorMessage = err.error?.error || 'Failed to delete variant';
            this.modalService.showAlert('Error', errorMessage, '❌');
          }
        });
      }
    });
  }

  // Image Upload
  onFileSelected(event: any) {
    console.log('File selection event:', event);
    const file = event.target.files[0];
    console.log('Selected file:', file);
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.modalService.showAlert('Invalid File', 'Please select an image file.', '⚠️');
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.modalService.showAlert('File Too Large', 'Please select an image smaller than 5MB.', '⚠️');
        return;
      }
      
      this.selectedFile = file;
      console.log('File selected successfully:', file.name);
    }
  }

  uploadImage() {
    console.log('uploadImage() called, selectedFile:', this.selectedFile);
    if (!this.selectedFile) {
      this.modalService.showAlert('No File Selected', 'Please select an image to upload.', '⚠️');
      return;
    }

    console.log('Starting image upload...');
    this.uploadingImage = true;
    this.adminMenuService.uploadImage(this.selectedFile).subscribe({
      next: (response) => {
        console.log('Upload response:', response);
        
        // Add to images array
        if (!this.menuItemForm.images) {
          this.menuItemForm.images = [];
        }
        this.menuItemForm.images.push(response.imageUrl);
        
        // Set as primary image if no primary image is set
        if (!this.menuItemForm.image_url || this.menuItemForm.image_url.includes('data:image/svg+xml')) {
          this.menuItemForm.image_url = response.imageUrl;
        }
        
        console.log('Form after upload:', this.menuItemForm);
        this.uploadingImage = false;
        this.selectedFile = null;
        
        // Reset file input
        const fileInput = document.getElementById('imageUpload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        console.log('Image uploaded successfully, URL:', response.imageUrl);
        this.modalService.showAlert('Success', 'Image uploaded successfully!', '✅');
      },
      error: (err) => {
        console.error('Error uploading image:', err);
        this.uploadingImage = false;
        this.modalService.showAlert('Upload Error', 'Failed to upload image', '❌');
      }
    });
  }

  // Set primary image
  setPrimaryImage(imageUrl: string) {
    this.menuItemForm.image_url = imageUrl;
    console.log('Primary image set to:', imageUrl);
  }

  // Remove image from gallery
  removeImage(imageUrl: string) {
    if (this.menuItemForm.images) {
      const index = this.menuItemForm.images.indexOf(imageUrl);
      if (index > -1) {
        this.menuItemForm.images.splice(index, 1);
        
        // If removed image was the primary image, set new primary
        if (this.menuItemForm.image_url === imageUrl) {
          if (this.menuItemForm.images.length > 0) {
            this.menuItemForm.image_url = this.menuItemForm.images[0];
          } else {
            this.menuItemForm.image_url = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMkQyRDJEIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iI0ZGRkZGRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk1lbnUgSXRlbTwvdGV4dD48L3N2Zz4=';
          }
        }
        
        console.log('Image removed:', imageUrl);
      }
    }
  }

  // Utility methods
  formatPrice(price: number): string {
    return `₱${price.toFixed(2)}`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }
}