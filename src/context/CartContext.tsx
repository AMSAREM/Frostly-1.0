import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AmansoceanProduct } from '../data/amansoceanProducts';
import { trackStorefrontEvent } from '../services/storefrontService';

export interface CartItem {
  product: AmansoceanProduct;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: AmansoceanProduct, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  syncCatalogProducts: (liveProducts: AmansoceanProduct[]) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  totalCount: number;
  subtotal: number;
  bounceBadge: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'amansocean_cart_v1';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [bounceBadge, setBounceBadge] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Could not save cart to localStorage', e);
    }
  }, [items]);

  const addToCart = (product: AmansoceanProduct, quantity = 1) => {
    const maxStock =
      typeof product.stockKg === 'number' ? Math.max(0, Math.floor(product.stockKg)) : Infinity;
    if (product.inStock === false || maxStock <= 0) {
      return;
    }

    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const nextQty = Math.min(maxStock, existing.quantity + quantity);
        return prev.map((item) =>
          item.product.id === product.id
            ? { product, quantity: nextQty }
            : item
        );
      }
      return [...prev, { product, quantity: Math.min(maxStock, quantity) }];
    });

    trackStorefrontEvent('add_to_cart', {
      productId: product.id,
      productName: product.name,
      cartValue: Number((product.price * quantity).toFixed(2)),
    });

    // Trigger bounce animation
    setBounceBadge(true);
    setTimeout(() => {
      setBounceBadge(false);
    }, 700);
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const maxStock =
          typeof item.product.stockKg === 'number'
            ? Math.max(0, Math.floor(item.product.stockKg))
            : Infinity;
        return { ...item, quantity: Math.min(maxStock, quantity) };
      })
    );
  };

  const syncCatalogProducts = useCallback((liveProducts: AmansoceanProduct[]) => {
    if (!Array.isArray(liveProducts) || liveProducts.length === 0) return;
    const byId = new Map(liveProducts.map((p) => [p.id, p]));
    setItems((prev) =>
      prev
        .map((item) => {
          const fresh = byId.get(item.product.id);
          if (!fresh) return item;
          const maxStock =
            typeof fresh.stockKg === 'number' ? Math.max(0, Math.floor(fresh.stockKg)) : Infinity;
          if (maxStock <= 0 || fresh.inStock === false) {
            return null;
          }
          return {
            product: fresh,
            quantity: Math.min(item.quantity, maxStock),
          };
        })
        .filter((it): it is CartItem => it !== null)
    );
  }, []);

  const clearCart = () => {
    setItems([]);
  };

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        syncCatalogProducts,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        totalCount,
        subtotal,
        bounceBadge
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
