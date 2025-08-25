import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { MenuService, MenuItem } from './menu.service';
import { CartItem, CartService } from '../cart/cart.service';
import { AddToCartModalComponent } from '../shared/add-to-cart-modal.component';
import { ModalService } from '../shared/modal.service';
import { FeedbackService, CustomerFeedback, FeedbackStats } from '../feedback/feedback.service';
import { environment } from '../../environments/environment';


@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, HttpClientModule, AddToCartModalComponent],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
})
export class MenuComponent implements OnInit, OnDestroy {
  menuItems: MenuItem[] = [];
  filteredMenuItems: MenuItem[] = [];
  loading = true;
  error = '';
  selectedVariants: { [key: number]: any } = {};
  currentImageIndex: { [key: number]: number } = {};
  searchTerm = '';
  selectedCategory = 'all';
  categories: { id: string, name: string, count: number }[] = [];
  quantities: { [key: number]: number } = {};
  
  // Feedback properties
  feedbackStats: FeedbackStats | null = null;
  testimonials: CustomerFeedback[] = [];
  currentTestimonialIndex = 0;
  testimonialInterval: any;

  // Typewriter animation properties
  typedText: string[] = ['', '', '', '', '', ''];
  currentLine = 0;
  showCursor = true;
  showBrandHighlight = false;
  showSecondLine = false;
  showHighlights = {
    burgers: false,
    charliechan: false,
    korean: false
  };
  private typewriterTimeout: any;
  private cursorInterval: any;

  // Animation elements
  particles: Array<{x: number, y: number, delay: number, duration: number}> = [];
  floatingEmojis: Array<{icon: string, x: number, y: number, delay: number, duration: number}> = [];
  private animationIntervals: any[] = [];
  
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
    private modalService: ModalService,
    private feedbackService: FeedbackService
  ) {}

  ngOnInit() {
    // Load menu items only - no stock checking needed
    this.loadMenuItems().then(() => {
      this.setupCategories();
      this.filteredMenuItems = [...this.menuItems];
      this.initializeQuantities();
      this.loading = false;
    }).catch((err) => {
      this.error = 'Failed to load menu.';
      this.loading = false;
      console.error(err);
    });

    // Load feedback data
    this.loadFeedbackData();

    // Subscribe to cart changes for count
    this.cartService.cart$.subscribe(items => {
      this.cartItemCount = items.reduce((total, item) => total + item.quantity, 0);
    });

    // Start typewriter animation
    this.startTypewriter();

    // Initialize animated elements
    this.initializeAnimatedElements();
  }

  ngOnDestroy() {
    // Clear testimonial interval
    if (this.testimonialInterval) {
      clearInterval(this.testimonialInterval);
    }
    // Clear typewriter intervals
    if (this.typewriterTimeout) {
      clearTimeout(this.typewriterTimeout);
    }
    if (this.cursorInterval) {
      clearInterval(this.cursorInterval);
    }
    // Clear animation intervals
    this.animationIntervals.forEach(interval => clearInterval(interval));
  }

  private loadMenuItems(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Loading menu items from:', environment.apiUrl + '/menu');
      this.menuService.getMenuItems().subscribe({
        next: (data) => {
          console.log('Menu items loaded successfully:', data);
          this.menuItems = data;
          this.markChefRecommendations();
          resolve();
        },
        error: (err) => {
          console.error('Error loading menu items:', err);
          console.error('API URL:', environment.apiUrl + '/menu');
          console.error('Error details:', {
            status: err.status,
            statusText: err.statusText,
            message: err.message,
            error: err.error
          });
          
          // Set a more descriptive error message based on the error type
          if (err.status === 0) {
            this.error = 'Cannot connect to server. Please check your internet connection.';
          } else if (err.status >= 500) {
            this.error = 'Server error. Please try again later.';
          } else if (err.status === 404) {
            this.error = 'Menu service not found.';
          } else {
            this.error = `Failed to load menu. Error: ${err.status} ${err.statusText}`;
          }
          
          reject(err);
        }
      });
    });
  }


  addItemToCart(item: MenuItem) {
    let variant: string;
    let price: number;
    const quantity = this.quantities[item.id] || 1;
    
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
      quantity: quantity,
    };
    
    this.cartService.addToCart(cartItem);
    
    // Show modal instead of alert
    this.modalData = {
      itemName: item.name,
      variant: variant,
      price: price * quantity,
      itemImage: item.image_url || item.images?.[0] || ''
    };
    this.showModal = true;
    
    // Reset selection for this item
    delete this.selectedVariants[item.id];
    this.quantities[item.id] = 1;
    
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

  // Category and filtering methods
  setupCategories() {
    const categoryMap = new Map<string, number>();
    
    this.menuItems.forEach(item => {
      const category = this.inferCategory(item.name);
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    // Prioritize main categories in specific order
    const priorityCategories = ['burgers', 'pasta'];
    const mainCategories: { id: string, name: string, count: number }[] = [];
    
    // Add prioritized categories first
    priorityCategories.forEach(categoryId => {
      if (categoryMap.has(categoryId)) {
        mainCategories.push({
          id: categoryId,
          name: this.formatCategoryName(categoryId),
          count: categoryMap.get(categoryId) || 0
        });
      }
    });

    // Add remaining categories
    const remainingCategories = Array.from(categoryMap.entries())
      .filter(([id]) => !priorityCategories.includes(id))
      .map(([id, count]) => ({
        id,
        name: this.formatCategoryName(id),
        count
      }));

    this.categories = [
      { id: 'all', name: 'All Items', count: this.menuItems.length },
      ...mainCategories,
      ...remainingCategories
    ];
  }

  inferCategory(itemName: string): string {
    const name = itemName.toLowerCase();
    if (name.includes('burger') || name.includes('beef') || name.includes('chicken sandwich') || name.includes('bulgogi')) {
      return 'burgers';
    } else if (name.includes('pasta') || name.includes('charlie chan') || name.includes('noodle')) {
      return 'pasta';
    } else if (name.includes('chicken') && !name.includes('sandwich')) {
      return 'chicken';
    } else if (name.includes('rice') || name.includes('fried rice')) {
      return 'rice';
    } else if (name.includes('drink') || name.includes('beverage') || name.includes('soda') || name.includes('juice')) {
      return 'beverages';
    } else if (name.includes('dessert') || name.includes('cake') || name.includes('ice cream') || name.includes('cookie')) {
      return 'desserts';
    }
    return 'others';
  }

  formatCategoryName(category: string): string {
    const names: { [key: string]: string } = {
      'burgers': 'Burgers',
      'pasta': 'Pasta & Noodles',
      'chicken': 'Chicken',
      'rice': 'Rice Dishes',
      'beverages': 'Beverages',
      'desserts': 'Desserts',
      'others': 'Other Items'
    };
    return names[category] || category;
  }

  initializeQuantities() {
    this.menuItems.forEach(item => {
      this.quantities[item.id] = 1;
    });
  }

  onSearchChange(event: any) {
    this.searchTerm = event.target.value;
    this.filterItems();
  }

  onCategoryChange(categoryId: string) {
    this.selectedCategory = categoryId;
    this.filterItems();
  }

  filterItems() {
    let filtered = this.menuItems;

    // Filter by category
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(item => 
        this.inferCategory(item.name) === this.selectedCategory
      );
    }

    // Filter by search term
    if (this.searchTerm.trim()) {
      const search = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search)
      );
    }

    this.filteredMenuItems = filtered;
  }

  getItemsByCategory() {
    const grouped: { [key: string]: MenuItem[] } = {};
    
    this.filteredMenuItems.forEach(item => {
      const category = this.inferCategory(item.name);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });

    return grouped;
  }

  incrementQuantity(itemId: number) {
    this.quantities[itemId] = (this.quantities[itemId] || 1) + 1;
  }

  decrementQuantity(itemId: number) {
    if (this.quantities[itemId] > 1) {
      this.quantities[itemId]--;
    }
  }

  getDietaryInfo(itemName: string): string[] {
    const dietary: string[] = [];
    const name = itemName.toLowerCase();
    
    if (name.includes('chicken') || name.includes('beef')) {
      // Non-vegetarian items
    } else {
      dietary.push('vegetarian');
    }
    
    if (name.includes('spicy') || name.includes('hot')) {
      dietary.push('spicy');
    }
    
    return dietary;
  }

  getEstimatedTime(itemName: string): string {
    const name = itemName.toLowerCase();
    if (name.includes('burger') || name.includes('sandwich')) {
      return '10-15 min';
    } else if (name.includes('pasta') || name.includes('rice')) {
      return '15-20 min';
    }
    return '5-10 min';
  }

  getSelectedCategoryName(): string {
    const category = this.categories.find(c => c.id === this.selectedCategory);
    return category ? category.name : '';
  }

  // Mark specific items as chef recommendations
  markChefRecommendations() {
    const chefRecommendations = [
      'spicy bulgogi',
      'charlie chan',
      'bulgogi burger'
    ];

    this.menuItems.forEach(item => {
      const itemName = item.name.toLowerCase();
      item.isChefRecommendation = chefRecommendations.some(rec => 
        itemName.includes(rec)
      );
    });
  }

  // Load feedback data
  loadFeedbackData() {
    // Load feedback statistics
    this.feedbackService.getFeedbackStats().subscribe({
      next: (stats) => {
        this.feedbackStats = stats;
      },
      error: (error) => {
        console.error('Error loading feedback stats:', error);
        // No fallback - only show real feedback when available
      }
    });

    // Load testimonials for carousel
    this.feedbackService.getRandomTestimonials(5).subscribe({
      next: (testimonials) => {
        this.testimonials = testimonials;
        if (testimonials.length > 0) {
          this.startTestimonialRotation();
        }
      },
      error: (error) => {
        console.error('Error loading testimonials:', error);
        // No fallback - only show real feedback when available
      }
    });
  }


  // Start testimonial rotation
  startTestimonialRotation() {
    if (this.testimonials.length <= 1) return;

    this.testimonialInterval = setInterval(() => {
      this.currentTestimonialIndex = (this.currentTestimonialIndex + 1) % this.testimonials.length;
    }, 6000); // Change every 6 seconds
  }

  // Get current testimonial
  getCurrentTestimonial(): CustomerFeedback | null {
    if (this.testimonials.length === 0) return null;
    return this.testimonials[this.currentTestimonialIndex] || null;
  }

  // Get star display for rating
  getStarDisplay(rating: number): string {
    return this.feedbackService.getStarDisplay(rating);
  }

  // Format time ago
  formatTimeAgo(daysAgo: number): string {
    return this.feedbackService.formatTimeAgo(daysAgo);
  }

  // Typewriter Animation Methods
  startTypewriter() {
    // Start cursor blinking
    this.cursorInterval = setInterval(() => {
      this.showCursor = !this.showCursor;
    }, 530);

    // Start typing the first line
    this.typeFirstLine();
  }

  private typeFirstLine() {
    const fullText = [
      'Welcome to ',
      ' – your destination for exceptional comfort food!'
    ];
    
    let charIndex = 0;
    let partIndex = 0;

    const typeChar = () => {
      if (partIndex < fullText.length) {
        const currentPart = fullText[partIndex];
        
        if (charIndex < currentPart.length) {
          this.typedText[partIndex] += currentPart.charAt(charIndex);
          charIndex++;
          this.typewriterTimeout = setTimeout(typeChar, 50);
        } else {
          // Show brand highlight when we reach "Helen's Kitchen"
          if (partIndex === 0) {
            this.showBrandHighlight = true;
            this.typewriterTimeout = setTimeout(() => {
              partIndex++;
              charIndex = 0;
              typeChar();
            }, 800); // Pause to highlight brand
          } else {
            // First line complete, start second line
            this.typewriterTimeout = setTimeout(() => {
              this.showSecondLine = true;
              this.currentLine = 1;
              this.typeSecondLine();
            }, 1200);
          }
        }
      }
    };

    typeChar();
  }

  private typeSecondLine() {
    const fullText = [
      'From our perfectly seasoned ',
      ' with authentic ',
      ' and our signature Chicken pasta ala ',
      ', we bring you diverse, delicious dishes made with premium ingredients and served with love.'
    ];
    
    let charIndex = 0;
    let partIndex = 0;

    const typeChar = () => {
      if (partIndex < fullText.length) {
        const currentPart = fullText[partIndex];
        
        if (charIndex < currentPart.length) {
          this.typedText[partIndex + 2] += currentPart.charAt(charIndex);
          charIndex++;
          this.typewriterTimeout = setTimeout(typeChar, 35);
        } else {
          // Show highlights at specific points
          if (partIndex === 0) {
            this.showHighlights.burgers = true;
            this.typewriterTimeout = setTimeout(() => {
              partIndex++;
              charIndex = 0;
              typeChar();
            }, 600);
          } else if (partIndex === 1) {
            this.showHighlights.charliechan = true;
            this.typewriterTimeout = setTimeout(() => {
              partIndex++;
              charIndex = 0;
              typeChar();
            }, 600);
          } else if (partIndex === 2) {
            this.showHighlights.korean = true;
            this.typewriterTimeout = setTimeout(() => {
              partIndex++;
              charIndex = 0;
              typeChar();
            }, 600);
          } else {
            // Animation complete
            this.typewriterTimeout = setTimeout(() => {
              this.showCursor = false;
              if (this.cursorInterval) {
                clearInterval(this.cursorInterval);
              }
            }, 1000);
          }
        }
      }
    };

    typeChar();
  }

  // Animation initialization methods
  private initializeAnimatedElements() {
    this.createFloatingParticles();
    this.createFloatingEmojis();
    this.startParticleAnimation();
  }

  private createFloatingParticles() {
    this.particles = [];
    for (let i = 0; i < 25; i++) {
      this.particles.push({
        x: Math.random() * 800,
        y: Math.random() * 400,
        delay: Math.random() * 5,
        duration: 3 + Math.random() * 4
      });
    }
  }

  private createFloatingEmojis() {
    const foodEmojis = ['🍔', '🍝', '🍗', '🍖', '🌶️', '🥘', '🍜', '🥗', '🍳', '🥙', '🌯', '🍞'];
    this.floatingEmojis = [];
    
    for (let i = 0; i < 12; i++) {
      this.floatingEmojis.push({
        icon: foodEmojis[Math.floor(Math.random() * foodEmojis.length)],
        x: Math.random() * 90 + 5, // 5% to 95%
        y: Math.random() * 80 + 10, // 10% to 90%
        delay: Math.random() * 8,
        duration: 6 + Math.random() * 8
      });
    }
  }

  private startParticleAnimation() {
    // Regenerate particles periodically for continuous movement
    const particleRefresh = setInterval(() => {
      this.particles.forEach(particle => {
        particle.x = Math.random() * 800;
        particle.y = Math.random() * 400;
        particle.delay = Math.random() * 2;
        particle.duration = 3 + Math.random() * 4;
      });
    }, 8000);

    // Regenerate emojis periodically
    const emojiRefresh = setInterval(() => {
      this.floatingEmojis.forEach(emoji => {
        emoji.x = Math.random() * 90 + 5;
        emoji.y = Math.random() * 80 + 10;
        emoji.delay = Math.random() * 3;
        emoji.duration = 6 + Math.random() * 8;
      });
    }, 12000);

    this.animationIntervals.push(particleRefresh, emojiRefresh);
  }

}
