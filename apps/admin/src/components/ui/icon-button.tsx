import { LucideIcon } from "lucide-react";

type IconButtonProps = {
  icon: LucideIcon;
  onClick?: () => void;
  title: string;
  variant?: "default" | "primary" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
};

const variants = {
  default: "btn-circle",
  primary: "btn-circle btn-circle-primary",
  danger: "btn-circle btn-circle-danger",
};

export function IconButton({
  icon: Icon,
  onClick,
  title,
  variant = "default",
  type = "button",
  disabled,
}: IconButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={variants[variant]}
    >
      <Icon size={15} strokeWidth={2} />
    </button>
  );
}
