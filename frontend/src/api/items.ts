import { apiRequest } from "./client";
import type { Item, ItemListResponse, ItemCreate, ItemUpdate } from "@/types/item";

export async function getItems(): Promise<ItemListResponse> {
  return apiRequest<ItemListResponse>("/items");
}

export async function getItem(id: string): Promise<Item> {
  return apiRequest<Item>(`/items/${id}`);
}

export async function createItem(data: ItemCreate): Promise<Item> {
  return apiRequest<Item>("/items", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateItem(id: string, data: ItemUpdate): Promise<Item> {
  return apiRequest<Item>(`/items/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteItem(id: string): Promise<void> {
  return apiRequest<void>(`/items/${id}`, {
    method: "DELETE",
  });
}
