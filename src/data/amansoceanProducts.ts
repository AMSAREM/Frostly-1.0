export const CURRENCY = '$';

export interface AmansoceanProduct {
  id: string;
  name: string;
  category: 'Seafood' | 'Ready Meals' | 'Fries & Sides' | 'Cool Treats';
  description: string;
  price: number;
  image: string;
  badge?: 'New' | 'Hot' | 'Best Seller';
  weight?: string;
  rating?: number;
  origin?: string;
}

export const AMANSOCEAN_CATEGORIES = [
  {
    id: 'Seafood',
    label: 'Seafood',
    theme: 'red', // red speech bubble
    image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80',
    tagline: 'Flash-frozen wild catch'
  },
  {
    id: 'Ready Meals',
    label: 'Ready Meals',
    theme: 'yellow', // yellow speech bubble
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    tagline: 'Oven & pan ready in 15 mins'
  },
  {
    id: 'Fries & Sides',
    label: 'Fries & Sides',
    theme: 'red', // red speech bubble
    image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80',
    tagline: 'Crispy sides & golden cuts'
  }
] as const;

export const FEATURED_PRODUCTS: AmansoceanProduct[] = [
  {
    id: 'prod-prawns-500g',
    name: 'Jumbo Tiger Prawns 500g',
    category: 'Seafood',
    description: 'Sustainably wild-caught, head-on jumbo prawns flash-frozen within 2 hours of catch for maximum sweetness.',
    price: 18.99,
    image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=800&q=80',
    badge: 'Hot',
    weight: '500g',
    rating: 4.9,
    origin: 'Indian Ocean'
  },
  {
    id: 'prod-fish-fingers-750g',
    name: 'Crispy Fish Fingers 750g',
    category: 'Ready Meals',
    description: '100% whole Atlantic cod fillets coated in ultra-crisp golden panko crumb. Kid favorite, oven ready.',
    price: 11.50,
    image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
    badge: 'New',
    weight: '750g',
    rating: 4.8,
    origin: 'North Atlantic'
  },
  {
    id: 'prod-fries-1kg',
    name: 'Golden Fries 1kg',
    category: 'Fries & Sides',
    description: 'Extra crispy Belgian-style cut russet potatoes coated in light batter for restaurant crunch at home.',
    price: 6.25,
    image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=800&q=80',
    badge: 'Hot',
    weight: '1kg',
    rating: 4.7,
    origin: 'Farm Fresh Russet'
  },
  {
    id: 'prod-salmon-fillet-600g',
    name: 'Norwegian Salmon Portions 600g',
    category: 'Seafood',
    description: 'Skin-on, boneless prime salmon fillets with rich omega-3 marbling. Individually vacuum sealed.',
    price: 21.00,
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
    badge: 'Best Seller',
    weight: '600g',
    rating: 5.0,
    origin: 'Norwegian Fjords'
  },
  {
    id: 'prod-calamari-rings-500g',
    name: 'Tender Calamari Rings 500g',
    category: 'Ready Meals',
    description: 'Tender squid rings in light salt and pepper dusting. Perfect for quick frying or air fryer dipping.',
    price: 13.75,
    image: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80',
    badge: 'New',
    weight: '500g',
    rating: 4.8,
    origin: 'Pacific Ocean'
  },
  {
    id: 'prod-onion-rings-750g',
    name: 'Beer-Battered Onion Rings 750g',
    category: 'Fries & Sides',
    description: 'Thick whole sweet Spanish onion rings dipped in craft brew batter for crunchy golden perfection.',
    price: 7.50,
    image: 'https://images.unsplash.com/photo-1639024471287-0351860db52e?auto=format&fit=crop&w=800&q=80',
    badge: 'Hot',
    weight: '750g',
    rating: 4.6,
    origin: 'Spanish Valleys'
  }
];

export const COOL_TREATS_PRODUCTS: AmansoceanProduct[] = [
  {
    id: 'prod-mango-sorbet-500ml',
    name: 'Alphonso Mango Frozen Sorbet 500ml',
    category: 'Cool Treats',
    description: 'Dairy-free, pure real Alphonso mango pulp churned into refreshing frozen silkiness.',
    price: 8.50,
    image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=800&q=80',
    badge: 'Hot',
    weight: '500ml',
    rating: 4.9
  },
  {
    id: 'prod-gelato-sea-salt-500ml',
    name: 'Artisan Sea Salt Caramel Gelato 500ml',
    category: 'Cool Treats',
    description: 'Rich slow-churned whole cream with deep dark caramel swirl and ocean fleur de sel flakes.',
    price: 9.25,
    image: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=800&q=80',
    badge: 'Best Seller',
    weight: '500ml',
    rating: 5.0
  }
];
