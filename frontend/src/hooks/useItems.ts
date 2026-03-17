import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getItems, createItem, deleteItem } from "@/api/items";
import type { ItemCreate, ItemListResponse } from "@/types/item";

const ITEMS_KEY = ["items"] as const;

export function useItems() {
  return useQuery<ItemListResponse>({
    queryKey: ITEMS_KEY,
    queryFn: getItems,
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ItemCreate) => createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY });
    },
  });
}
