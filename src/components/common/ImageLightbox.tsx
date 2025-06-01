import React, { useEffect, useRef } from 'react';

interface ImageLightboxProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ imageUrl, onClose }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null); // Ref for the image itself for focusing

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (imageUrl) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
      // Focus the image or a focusable element within the lightbox when it opens
      imageRef.current?.focus(); // Or a close button if image itself is not focusable
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = '';
    };
  }, [imageUrl, onClose]);

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Close if the click is directly on the overlay, not its children (like the image or close button)
    if (overlayRef.current === event.target) {
      onClose();
    }
  };

  if (!imageUrl) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className="image-lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Увеличенное изображение"
      onClick={handleOverlayClick}
    >
      <button
        onClick={onClose}
        className="image-lightbox-close-button"
        aria-label="Закрыть увеличенное изображение"
        // autoFocus // Consider if close button should be auto-focused
      >
        &times;
      </button>
      {/* The image-lightbox-content div acts as a padded container for the image */}
      <div className="image-lightbox-content">
        <img 
            ref={imageRef} 
            src={imageUrl} 
            alt="Увеличенное изображение" 
            className="image-lightbox-image" 
            tabIndex={-1} // Make it focusable programmatically if needed
        />
      </div>
    </div>
  );
};
