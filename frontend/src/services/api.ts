// All calls go through /api → proxied by Nginx to http://api:3001
const BASE = "/api";

export type Recipe = {
  id: number;
  name: string;
  description: string | null;
  servings: number;
  created_at: string;
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

export type MealPlan = {
  id: number;
  date: string;
  meal_type: "midi" | "soir";
  portions: number;
  recipe_id: number;
  recipe_name: string;
  recipe_servings: number;
};

export type ShoppingItem = {
  ingredient: string;
  quantity: number;
  unit: string;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
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
};
