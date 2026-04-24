import * as LucideIcons from "lucide-react";
import type { CategoryColor } from "./constants";
import { COLOR_VARS } from "./constants";

interface CatSwatchProps {
  color: CategoryColor;
  icon: string;
  size?: number;
}

export function CatSwatch({ color, icon, size = 34 }: CatSwatchProps) {
  const radius = Math.round(size * 0.3);
  const colors = COLOR_VARS[color];
  const IconComponent =
    (LucideIcons as unknown as Record<string, React.ElementType>)[icon] ??
    LucideIcons.Tag;
  const iconSize = Math.round(size * 0.52);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: colors.bg,
        color: colors.ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <IconComponent size={iconSize} strokeWidth={1.75} />
    </div>
  );
}
