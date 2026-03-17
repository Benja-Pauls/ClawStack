export interface Item {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemListResponse {
  items: Item[];
  total: number;
  skip: number;
  limit: number;
}

export interface ItemCreate {
  name: string;
  description?: string | null;
}

export interface ItemUpdate {
  name?: string;
  description?: string | null;
}
