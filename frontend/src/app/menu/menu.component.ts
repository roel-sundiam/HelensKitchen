import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { MenuService, MenuItem } from './menu.service';
import { CartItem, CartService } from '../cart/cart.service';
import { AddToCartModalComponent } from '../shared/add-to-cart-modal.component';
import { ModalService } from '../shared/modal.service';


@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, HttpClientModule, AddToCartModalComponent],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
})
export class MenuComponent implements OnInit {
  menuItems: MenuItem[] = [];
  loading = true;
  error = '';
  selectedVariants: { [key: number]: any } = {};
  currentImageIndex: { [key: number]: number } = {};
  
  // Modal properties
  showModal = false;
  modalData = {
    itemName: '',
    variant: '',
    price: 0,
    itemImage: ''
  };
  cartItemCount = 0;

  constructor(
    private menuService: MenuService,
    private cartService: CartService,
    private http: HttpClient,
    private modalService: ModalService
  ) {}

  ngOnInit() {
    // Load menu items only - no stock checking needed
    this.loadMenuItems().then(() => {
      this.loading = false;
    }).catch((err) => {
      this.error = 'Failed to load menu.';
      this.loading = false;
      console.error(err);
    });

    // Subscribe to cart changes for count
    this.cartService.cart$.subscribe(items => {
      this.cartItemCount = items.reduce((total, item) => total + item.quantity, 0);
    });
  }

  private loadMenuItems(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.menuService.getMenuItems().subscribe({
        next: (data) => {
          this.menuItems = data;
          resolve();
        },
        error: (err) => reject(err)
      });
    });
  }


  addItemToCart(item: MenuItem) {
    let variant: string;
    let price: number;
    
    if (item.variants && item.variants.length > 0) {
      const selectedVariant = this.selectedVariants[item.id];
      if (!selectedVariant) {
        this.modalService.showAlert('Selection Required', 'Please select a variant first.', '⚠️');
        return;
      }
      variant = selectedVariant.name;
      price = selectedVariant.price;
    } else {
      variant = 'Standard';
      price = item.base_price;
    }

    const cartItem: CartItem = {
      menuItem: item,
      variant: variant,
      price: price,
      quantity: 1,
    };
    
    this.cartService.addToCart(cartItem);
    
    // Show modal instead of alert
    this.modalData = {
      itemName: item.name,
      variant: variant,
      price: price,
      itemImage: item.image_url || item.images?.[0] || ''
    };
    this.showModal = true;
    
    // Reset selection for this item
    delete this.selectedVariants[item.id];
    
    // Clear radio button selections
    const radioButtons = document.getElementsByName('variant_' + item.id) as NodeListOf<HTMLInputElement>;
    radioButtons.forEach(radio => radio.checked = false);
  }

  addToCart(item: MenuItem, variantName: string, variantPrice: number) {
    const cartItem: CartItem = {
      menuItem: item,
      variant: variantName,
      price: variantPrice,
      quantity: 1,
    };
    this.cartService.addToCart(cartItem);
    
    // Show modal instead of alert
    this.modalData = {
      itemName: item.name,
      variant: variantName,
      price: variantPrice,
      itemImage: item.image_url || item.images?.[0] || ''
    };
    this.showModal = true;
  }

  // Modal event handlers
  closeModal() {
    this.showModal = false;
  }

  onContinueShopping() {
    // Just close modal, user stays on menu page
  }

  onViewCart() {
    // Navigation handled by the modal component
  }

  // Image Carousel Methods
  setCurrentImage(itemId: number, imageIndex: number) {
    this.currentImageIndex[itemId] = imageIndex;
  }

  nextImage(itemId: number, totalImages: number) {
    const currentIndex = this.currentImageIndex[itemId] || 0;
    this.currentImageIndex[itemId] = (currentIndex + 1) % totalImages;
  }

  previousImage(itemId: number, totalImages: number) {
    const currentIndex = this.currentImageIndex[itemId] || 0;
    this.currentImageIndex[itemId] = currentIndex === 0 ? totalImages - 1 : currentIndex - 1;
  }

}
