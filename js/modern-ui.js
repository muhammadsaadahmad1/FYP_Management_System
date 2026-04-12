// 🎨 Modern Component System for FYP Management System

class ModernUI {
  constructor() {
    this.init();
  }

  init() {
    console.log('🎨 Modern UI System Initializing...');
    this.setupNotifications();
    this.setupAnimations();
    this.setupMobileOptimizations();
  }

  // 🔔 Notification System
  setupNotifications() {
    this.notificationQueue = [];
    this.isShowingNotification = false;
  }

  showNotification(message, type = 'info', duration = 5000) {
    this.notificationQueue.push({ message, type, duration });
    
    if (!this.isShowingNotification) {
      this.processNotificationQueue();
    }
  }

  processNotificationQueue() {
    if (this.notificationQueue.length === 0) {
      this.isShowingNotification = false;
      return;
    }

    this.isShowingNotification = true;
    const { message, type, duration } = this.notificationQueue.shift();

    const notification = this.createNotification(message, type);
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);

    // Remove after duration
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
        this.processNotificationQueue();
      }, 300);
    }, duration);
  }

  createNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };

    notification.innerHTML = `
      <div class="notification-content">
        <i class="${icons[type]}"></i>
        <span class="notification-message">${message}</span>
        <button class="notification-close" aria-label="Close notification">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    // Close button handler
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    });

    return notification;
  }

  // 🎨 Loading States
  showLoading(element, text = 'Loading...') {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span class="loading-text">${text}</span>
      </div>
    `;

    element.style.position = 'relative';
    element.appendChild(loadingOverlay);
    element.classList.add('loading');
  }

  hideLoading(element) {
    const overlay = element.querySelector('.loading-overlay');
    if (overlay) {
      overlay.remove();
    }
    element.classList.remove('loading');
  }

  // 📊 Progress Indicators
  createProgressBar(progress = 0, color = 'primary') {
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.innerHTML = `
      <div class="progress-fill" style="width: ${progress}%; background: var(--${color}-600)">
        <span class="progress-text">${progress}%</span>
      </div>
    `;
    return progressBar;
  }

  updateProgressBar(progressBar, progress) {
    const fill = progressBar.querySelector('.progress-fill');
    const text = progressBar.querySelector('.progress-text');
    
    fill.style.width = `${progress}%`;
    text.textContent = `${progress}%`;
  }

  // 🎯 Status Badges
  createBadge(text, status = 'info') {
    const badge = document.createElement('span');
    badge.className = `badge badge-${status}`;
    badge.textContent = text;
    return badge;
  }

  // 📱 Modal System
  createModal(title, content, options = {}) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" aria-label="Close modal">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
      </div>
    `;

    // Close handlers
    const closeBtn = modal.querySelector('.modal-close');
    const overlay = modal.querySelector('.modal-overlay');
    
    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    if (options.closeOnEscape) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
      });
    }

    // Show modal
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 100);

    return modal;
  }

  // 🎨 Animations
  setupAnimations() {
    // Intersection Observer for fade-in animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observe elements with animation class
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      observer.observe(el);
    });
  }

  // 📱 Mobile Optimizations
  setupMobileOptimizations() {
    // Touch-friendly navigation
    this.setupMobileNavigation();
    
    // Responsive tables
    this.setupResponsiveTables();
    
    // Mobile-friendly modals
    this.setupMobileModals();
  }

  setupMobileNavigation() {
    const navToggle = document.createElement('button');
    navToggle.className = 'mobile-nav-toggle';
    navToggle.innerHTML = '<i class="fas fa-bars"></i>';
    navToggle.setAttribute('aria-label', 'Toggle navigation');

    const nav = document.querySelector('.nav');
    if (nav) {
      nav.parentNode.insertBefore(navToggle, nav);

      navToggle.addEventListener('click', () => {
        nav.classList.toggle('mobile-open');
        navToggle.classList.toggle('active');
      });
    }
  }

  setupResponsiveTables() {
    document.querySelectorAll('.table').forEach(table => {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-responsive';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  setupMobileModals() {
    if (window.innerWidth <= 768) {
      document.querySelectorAll('.modal-content').forEach(modal => {
        modal.style.width = '95%';
        modal.style.margin = '2.5% auto';
      });
    }
  }

  // 🎯 Form Validation
  validateForm(form) {
    const errors = [];
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');

    inputs.forEach(input => {
      if (!input.value.trim()) {
        errors.push(`${input.name || input.id} is required`);
        this.showFieldError(input, 'This field is required');
      } else {
        this.clearFieldError(input);
      }

      // Email validation
      if (input.type === 'email' && input.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.value)) {
          errors.push('Please enter a valid email address');
          this.showFieldError(input, 'Please enter a valid email address');
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  showFieldError(field, message) {
    this.clearFieldError(field);
    
    field.classList.add('error');
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    
    field.parentNode.appendChild(errorElement);
  }

  clearFieldError(field) {
    field.classList.remove('error');
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
      errorElement.remove();
    }
  }

  // 📊 Data Visualization
  createChart(container, data, type = 'bar') {
    const chart = document.createElement('div');
    chart.className = `chart chart-${type}`;
    
    // Simple bar chart implementation
    if (type === 'bar') {
      const maxValue = Math.max(...data.map(d => d.value));
      const bars = data.map(item => `
        <div class="chart-bar">
          <div class="bar-fill" style="height: ${(item.value / maxValue) * 100}%">
            <span class="bar-label">${item.label}</span>
            <span class="bar-value">${item.value}</span>
          </div>
        </div>
      `).join('');
      
      chart.innerHTML = `<div class="chart-bars">${bars}</div>`;
    }
    
    container.appendChild(chart);
    return chart;
  }

  // 🎨 Utility Functions
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // 📱 Device Detection
  isMobile() {
    return window.innerWidth <= 768;
  }

  isTablet() {
    return window.innerWidth > 768 && window.innerWidth <= 1024;
  }

  isDesktop() {
    return window.innerWidth > 1024;
  }

  // 🎯 Accessibility
  setupAccessibility() {
    // Focus management
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    });

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-navigation');
    });

    // ARIA live regions for notifications
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
  }
}

// 🚀 Initialize Modern UI System
const modernUI = new ModernUI();

// 🎨 Export for global use
window.ModernUI = ModernUI;
window.modernUI = modernUI;

// 📱 Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎨 Modern UI System Ready!');
  
  // Show welcome notification
  setTimeout(() => {
    modernUI.showNotification('Welcome to the modernized FYP Management System!', 'success', 2000);
  }, 1000);
});

// 🎯 Global notification function (for compatibility)
window.showNotification = (message, type = 'info') => {
  modernUI.showNotification(message, type);
};
