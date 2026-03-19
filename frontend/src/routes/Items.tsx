import { useState } from "react";
import { Link } from "react-router-dom";
import { useItems, useCreateItem, useDeleteItem } from "@/hooks/useItems";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/Button";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function Items() {
  const { data, isLoading, error } = useItems();
  const items = data?.items;
  const createItem = useCreateItem();
  const deleteItem = useDeleteItem();
  const { isAuthenticated } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    createItem.mutate(
      { name: name.trim(), description: description.trim() || null },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
        },
      },
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Items</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your items collection.
        </p>
      </div>

      {/* Create form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-surface-raised p-6"
      >
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Create Item
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Description
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button type="submit" disabled={createItem.isPending || !name.trim()}>
            {createItem.isPending ? "Creating..." : "Create Item"}
          </Button>
        </div>
        {createItem.isError && (
          <p className="mt-2 text-sm text-danger">
            Failed to create item. Please try again.
          </p>
        )}
      </form>

      {!isAuthenticated && (
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to delete items and associate them with your account.
        </p>
      )}

      {/* Items list */}
      {isLoading && <LoadingSpinner className="py-12" />}

      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-6 text-center">
          <p className="text-danger">
            Failed to load items. Make sure the API server is running.
          </p>
        </div>
      )}

      {items && items.length === 0 && (
        <div className="rounded-xl border border-border bg-surface-raised p-12 text-center">
          <p className="text-muted-foreground">
            No items yet. Create one above to get started.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full">
            <thead className="border-b border-border bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="bg-surface transition-colors hover:bg-surface-raised"
                >
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {item.id}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {item.description || "--"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAuthenticated && (
                      <Button
                        variant="danger"
                        onClick={() => deleteItem.mutate(item.id)}
                        disabled={deleteItem.isPending}
                        className="text-xs"
                      >
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
