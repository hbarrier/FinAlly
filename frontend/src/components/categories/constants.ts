export type CategoryColor = "terracotta" | "sage" | "rose" | "teal" | "butter" | "lilac";

export const CATEGORY_COLORS: CategoryColor[] = [
  "terracotta",
  "sage",
  "rose",
  "teal",
  "butter",
  "lilac",
];

export const COLOR_VARS: Record<CategoryColor, { bg: string; ink: string; solid: string }> = {
  terracotta: { bg: "var(--terracotta-bg)", ink: "var(--terracotta-ink)", solid: "var(--terracotta)" },
  sage: { bg: "var(--sage-bg)", ink: "var(--sage-ink)", solid: "var(--sage)" },
  rose: { bg: "var(--rose-bg)", ink: "var(--rose-ink)", solid: "var(--rose)" },
  teal: { bg: "var(--teal-bg)", ink: "var(--teal-ink)", solid: "var(--teal)" },
  butter: { bg: "var(--butter-bg)", ink: "var(--butter-ink)", solid: "var(--butter)" },
  lilac: { bg: "var(--lilac-bg)", ink: "var(--lilac-ink)", solid: "var(--lilac)" },
};

export const CATEGORY_ICONS: { name: string; label: string }[] = [
  { name: "ShoppingCart", label: "Shopping" },
  { name: "Utensils", label: "Food" },
  { name: "Car", label: "Transport" },
  { name: "Home", label: "Housing" },
  { name: "Heart", label: "Health" },
  { name: "Plane", label: "Travel" },
  { name: "Coffee", label: "Coffee" },
  { name: "Gamepad2", label: "Gaming" },
  { name: "BookOpen", label: "Education" },
  { name: "Shirt", label: "Clothing" },
  { name: "Dumbbell", label: "Fitness" },
  { name: "Music", label: "Music" },
  { name: "Smartphone", label: "Tech" },
  { name: "GraduationCap", label: "Studies" },
  { name: "Baby", label: "Children" },
  { name: "PawPrint", label: "Pets" },
  { name: "Zap", label: "Utilities" },
  { name: "Wifi", label: "Internet" },
  { name: "TrendingUp", label: "Investment" },
  { name: "Banknote", label: "Income" },
  { name: "Gift", label: "Gifts" },
  { name: "Film", label: "Cinema" },
  { name: "Scissors", label: "Beauty" },
  { name: "Pill", label: "Pharmacy" },
  { name: "Building2", label: "Business" },
  { name: "Wrench", label: "Repairs" },
  { name: "Fuel", label: "Fuel" },
  { name: "Train", label: "Transit" },
  { name: "Pizza", label: "Takeaway" },
  { name: "Tag", label: "Other" },
];
