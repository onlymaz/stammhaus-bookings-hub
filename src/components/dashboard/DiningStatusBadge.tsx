import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DiningStatus } from "@/types/table";
import { Armchair, UtensilsCrossed, CheckCircle, XCircle, UserX, Clock } from "lucide-react";

interface DiningStatusBadgeProps {
  status: DiningStatus;
  className?: string;
}

const statusConfig: Record<DiningStatus, { 
  label: string; 
  icon: typeof Armchair;
  className: string;
}> = {
  pending: {
    label: "Ausstehend",
    icon: Clock,
    className: "bg-gray-500/10 text-gray-600 border-gray-500/30"
  },
  reserved: {
    label: "Reserviert",
    icon: UtensilsCrossed,
    className: "bg-blue-500/10 text-blue-600 border-blue-500/30"
  },
  seated: {
    label: "Platziert",
    icon: Armchair,
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
  },
  completed: {
    label: "Abgeschlossen",
    icon: CheckCircle,
    className: "bg-gray-500/10 text-gray-600 border-gray-500/30"
  },
  cancelled: {
    label: "Storniert",
    icon: XCircle,
    className: "bg-red-500/10 text-red-600 border-red-500/30"
  },
  no_show: {
    label: "Nicht erschienen",
    icon: UserX,
    className: "bg-orange-500/10 text-orange-600 border-orange-500/30"
  }
};

export const DiningStatusBadge = ({ status, className }: DiningStatusBadgeProps) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn("gap-1 font-medium", config.className, className)}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};
