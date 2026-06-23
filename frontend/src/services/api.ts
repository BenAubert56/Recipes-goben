// All calls go through /api → proxied by Nginx to http://api:3001
const BASE = "/api";

export type Recipe = {
  id: number;
  name: string;
  description: string | null;
  servings: number;
  created_at: string;
  image_url: string | null;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
};

export type RecipeStep = {
  id: number;
  step_number: number;
  instruction: string;
};

export type RecipeIngredient = {
  id: number;
  ingredient_id: number;
  name: string;
  quantity: number;
  unit: string;
};

export type MealType = "matin" | "midi" | "soir";

export type MealPlan = {
  id: number;
  date: string;
  meal_type: MealType;
  portions: number;
  recipe_id: number;
  recipe_name: string;
  recipe_servings: number;
};

export type ShoppingItem = {
  id?: number;
  ingredient: string;
  quantity: number | null;
  unit: string;
  extra: boolean;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getRecipes: () => request<Recipe[]>("/recipes"),
  getRecipe: (id: number) => request<Recipe>(`/recipes/${id}`),
  createRecipe: (data: Partial<Recipe>) =>
    request<Recipe>("/recipes", { method: "POST", body: JSON.stringify(data) }),
  updateRecipe: (id: number, data: Partial<Recipe>) =>
    request<Recipe>(`/recipes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRecipe: (id: number) => request<void>(`/recipes/${id}`, { method: "DELETE" }),
  setIngredients: (recipeId: number, ingredients: { name: string; quantity: number; unit: string }[]) =>
    request<void>(`/recipes/${recipeId}/ingredients`, {
      method: "PUT",
      body: JSON.stringify({ ingredients }),
    }),
  setSteps: (recipeId: number, steps: { instruction: string }[]) =>
    request<void>(`/recipes/${recipeId}/steps`, {
      method: "PUT",
      body: JSON.stringify({ steps }),
    }),

  searchIngredients: (q: string) =>
    request<string[]>(`/ingredients?q=${encodeURIComponent(q)}`),

  getMealPlans: (from: string, to: string) =>
    request<MealPlan[]>(`/meal-plans?from=${from}&to=${to}`),
  addMeal: (data: { date: string; meal_type: string; recipe_id: number; portions: number }) =>
    request<MealPlan>("/meal-plans", { method: "POST", body: JSON.stringify(data) }),
  updateMeal: (id: number, data: Partial<MealPlan>) =>
    request<MealPlan>(`/meal-plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMeal: (id: number) => request<void>(`/meal-plans/${id}`, { method: "DELETE" }),

  getShopping: (from: string, to: string) =>
    request<ShoppingItem[]>(`/shopping?from=${from}&to=${to}`),
  addShoppingExtra: (data: { week_start: string; name: string; quantity?: number | null; unit?: string | null }) =>
    request<{ id: number }>("/shopping/extras", { method: "POST", body: JSON.stringify(data) }),
  deleteShoppingExtra: (id: number) =>
    request<void>(`/shopping/extras/${id}`, { method: "DELETE" }),
};
