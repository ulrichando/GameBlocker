/**
 * ParentShield Website - Main JavaScript
 * Professional interactions and animations
 */

(function() {
    'use strict';

    // =========================================================================
    // NAVIGATION
    // =========================================================================

    const navbar = document.getElementById('navbar');
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');

    // Navbar scroll effect
    function handleScroll() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    // Mobile menu toggle
    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileToggle.classList.toggle('active');
        });

        // Close menu when clicking a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                mobileToggle.classList.remove('active');
            });
        });
    }

    // =========================================================================
    // SMOOTH SCROLL
    // =========================================================================

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // =========================================================================
    // SCROLL ANIMATIONS
    // =========================================================================

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });

    // =========================================================================
    // COUNTER ANIMATION
    // =========================================================================

    function animateCounter(element, target, duration = 2000) {
        const start = 0;
        const startTime = performance.now();

        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(start + (target - start) * easeOutQuart);

            element.textContent = formatNumber(current);

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        }

        requestAnimationFrame(updateCounter);
    }

    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(0) + 'M+';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(0) + ',000+';
        }
        return num.toString();
    }

    // Animate stats when visible
    const statsSection = document.querySelector('.stats');
    if (statsSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    document.querySelectorAll('.stat-item h3').forEach(stat => {
                        const text = stat.textContent;
                        let target;

                        if (text.includes('10,000')) target = 10000;
                        else if (text.includes('50M')) target = 50000000;
                        else if (text.includes('99.9')) {
                            // Animate percentage
                            animatePercentage(stat, 99.9, 2000);
                            return;
                        }
                        else if (text.includes('24/7')) {
                            stat.textContent = '24/7';
                            return;
                        }

                        if (target) {
                            animateCounter(stat, target, 2000);
                        }
                    });
                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        statsObserver.observe(statsSection);
    }

    function animatePercentage(element, target, duration) {
        const start = 0;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = (start + (target - start) * easeOutQuart).toFixed(1);

            element.textContent = current + '%';

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    // =========================================================================
    // TYPING EFFECT (Optional - for hero text)
    // =========================================================================

    function typeWriter(element, text, speed = 50) {
        let i = 0;
        element.textContent = '';

        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }

        type();
    }

    // =========================================================================
    // PARALLAX EFFECT
    // =========================================================================

    const heroOrbs = document.querySelectorAll('.hero-orb');

    function handleParallax() {
        const scrolled = window.pageYOffset;

        heroOrbs.forEach((orb, index) => {
            const speed = 0.1 + (index * 0.05);
            orb.style.transform = `translate(${scrolled * speed}px, ${scrolled * speed}px)`;
        });
    }

    if (heroOrbs.length > 0) {
        window.addEventListener('scroll', handleParallax);
    }

    // =========================================================================
    // BUTTON RIPPLE EFFECT
    // =========================================================================

    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();

            ripple.style.cssText = `
                position: absolute;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;

            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = e.clientX - rect.left - size / 2 + 'px';
            ripple.style.top = e.clientY - rect.top - size / 2 + 'px';

            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        });
    });

    // Add ripple animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // =========================================================================
    // DOWNLOAD TRACKING
    // =========================================================================

    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const platform = this.href.includes('windows') ? 'Windows' :
                           this.href.includes('macos') ? 'macOS' :
                           this.href.includes('linux') ? 'Linux' : 'Unknown';

            // Track download (analytics)
            console.log(`Download initiated: ${platform}`);

            // You can add analytics tracking here
            if (typeof gtag !== 'undefined') {
                gtag('event', 'download', {
                    'event_category': 'Downloads',
                    'event_label': platform
                });
            }
        });
    });

    // =========================================================================
    // FORM VALIDATION
    // =========================================================================

    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (result.status === 'success') {
                    alert('Thank you! We\'ll be in touch soon.');
                    this.reset();
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Something went wrong. Please try again.');
            }
        });
    }

    // =========================================================================
    // THEME DETECTION
    // =========================================================================

    function detectTheme() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            document.body.classList.add('dark-mode');
        }
    }

    // detectTheme(); // Uncomment if you add dark mode support

    // =========================================================================
    // KEYBOARD NAVIGATION
    // =========================================================================

    document.addEventListener('keydown', (e) => {
        // Escape closes mobile menu
        if (e.key === 'Escape' && navLinks.classList.contains('active')) {
            navLinks.classList.remove('active');
            mobileToggle.classList.remove('active');
        }
    });

    // =========================================================================
    // PERFORMANCE OPTIMIZATIONS
    // =========================================================================

    // Lazy load images
    const lazyImages = document.querySelectorAll('img[data-src]');
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        lazyImages.forEach(img => imageObserver.observe(img));
    }

    // =========================================================================
    // CONSOLE EASTER EGG
    // =========================================================================

    console.log('%c ParentShield ', 'background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; font-size: 24px; padding: 10px 20px; border-radius: 8px; font-weight: bold;');
    console.log('%c Protecting families in the digital age ', 'color: #64748B; font-size: 14px;');
    console.log('%c Want to work with us? careers@parentshield.app ', 'color: #4F46E5; font-size: 12px;');

})();
