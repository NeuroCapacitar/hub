export interface AuthMediaSlide {
  blurDataUrl: string;
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export interface AdminAuthMediaSlide extends AuthMediaSlide {
  isActive: boolean;
}
